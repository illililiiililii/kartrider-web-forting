#include <windows.h>
#include <tlhelp32.h>

#include <array>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <vector>

namespace {

constexpr std::uintptr_t kPhysicsTickRva = 0x00633420u;
constexpr std::uintptr_t kGetProtectedFloatRva = 0x00269050u;
constexpr std::array<std::uint8_t, 9> kExpectedTickPrologue = {
    0x55, 0x8B, 0xEC, 0x81, 0xEC, 0xE0, 0x03, 0x00, 0x00,
};
constexpr std::size_t kSampleCapacity = 262144;

struct Sample {
    volatile LONG ready = 0;
    std::uint32_t sequence = 0;
    std::uint32_t qpc_low = 0;
    std::uint32_t qpc_high = 0;
    std::uint32_t client_time_ms = 0;
    std::uint32_t kart = 0;
    std::uint32_t delta_ms = 0;
    float accumulator = 0.0F;
    std::uint8_t accumulator_enabled = 0;
    std::uint8_t accumulator_step = 0;
    std::uint8_t drift_gate = 0;
    std::uint8_t contact_any = 0;
    std::array<std::uint8_t, 4> wheel_contacts{};
    float booster_gauge = 0.0F;
    float speed_gauge = 0.0F;
    float gauge_total = 0.0F;
    float gauge_cap = 0.0F;
    std::array<float, 3> position{};
    std::array<float, 9> orientation{};
    std::array<float, 3> linear_velocity{};
    std::array<float, 3> angular_velocity{};
    std::array<float, 3> local_velocity{};
    std::array<float, 8> control_state{};
    std::array<float, 9> unresolved{};
};

HMODULE g_module = nullptr;
void* g_tick_trampoline = nullptr;
std::array<Sample, kSampleCapacity> g_samples{};
volatile LONG g_write_index = 0;
volatile LONG g_dropped = 0;
volatile LONG g_last_client_time = 0;
HANDLE g_log = INVALID_HANDLE_VALUE;

using GetProtectedFloat = float(__thiscall*)(void*);

bool encode_jump(std::uint8_t* output, const void* from, const void* to) noexcept {
    const auto origin = reinterpret_cast<std::intptr_t>(from) + 5;
    const auto destination = reinterpret_cast<std::intptr_t>(to);
    const auto displacement = destination - origin;
    if (displacement < INT32_MIN || displacement > INT32_MAX) {
        return false;
    }
    output[0] = 0xE9;
    const auto relative = static_cast<std::int32_t>(displacement);
    std::memcpy(output + 1, &relative, sizeof(relative));
    return true;
}

float read_float(const std::uint8_t* base, std::size_t offset) noexcept {
    __try {
        return *reinterpret_cast<const float*>(base + offset);
    } __except (EXCEPTION_EXECUTE_HANDLER) {
        return 0.0F;
    }
}

std::uint8_t read_u8(const std::uint8_t* base, std::size_t offset) noexcept {
    __try {
        return base[offset];
    } __except (EXCEPTION_EXECUTE_HANDLER) {
        return 0;
    }
}

float read_protected_float(std::uint8_t* kart, std::size_t offset) noexcept {
    __try {
        const auto image = reinterpret_cast<std::uintptr_t>(GetModuleHandleW(nullptr));
        const auto getter = reinterpret_cast<GetProtectedFloat>(image + kGetProtectedFloatRva);
        return getter(kart + offset);
    } __except (EXCEPTION_EXECUTE_HANDLER) {
        return 0.0F;
    }
}

extern "C" void __cdecl observe_physics_tick(void* kart_pointer, std::uint32_t client_time_ms) noexcept {
    const LONG slot = InterlockedIncrement(&g_write_index) - 1;
    if (slot < 0 || static_cast<std::size_t>(slot) >= g_samples.size()) {
        InterlockedIncrement(&g_dropped);
        return;
    }

    auto* kart = static_cast<std::uint8_t*>(kart_pointer);
    Sample& sample = g_samples[static_cast<std::size_t>(slot)];
    LARGE_INTEGER qpc{};
    QueryPerformanceCounter(&qpc);
    sample.sequence = static_cast<std::uint32_t>(slot);
    sample.qpc_low = qpc.LowPart;
    sample.qpc_high = static_cast<std::uint32_t>(qpc.HighPart);
    sample.client_time_ms = client_time_ms;
    sample.kart = static_cast<std::uint32_t>(reinterpret_cast<std::uintptr_t>(kart));
    const LONG previous = InterlockedExchange(&g_last_client_time, static_cast<LONG>(client_time_ms));
    sample.delta_ms = previous == 0 ? 0u : client_time_ms - static_cast<std::uint32_t>(previous);
    sample.accumulator = read_float(kart, 0x0F1Cu);
    sample.accumulator_enabled = read_u8(kart, 0x0F20u);
    sample.accumulator_step = read_u8(kart, 0x0F21u);
    sample.drift_gate = read_u8(kart, 0x0A9Cu);
    sample.contact_any = read_u8(kart, 0x0188u);
    for (std::size_t index = 0; index < sample.wheel_contacts.size(); ++index) {
        sample.wheel_contacts[index] = read_u8(kart, 0x09C4u + index);
    }
    sample.booster_gauge = read_protected_float(kart, 0x0A90u);
    sample.speed_gauge = read_protected_float(kart, 0x0AA0u);
    sample.gauge_total = read_protected_float(kart, 0x0AACu);
    sample.gauge_cap = read_protected_float(kart, 0x0734u);

    constexpr std::array<std::size_t, 3> position_offsets = {0x0090u, 0x0094u, 0x0098u};
    constexpr std::array<std::size_t, 9> orientation_offsets = {
        0x009Cu, 0x00A0u, 0x00A4u,
        0x00A8u, 0x00ACu, 0x00B0u,
        0x00B4u, 0x00B8u, 0x00BCu,
    };
    constexpr std::array<std::size_t, 3> linear_velocity_offsets = {0x00C0u, 0x00C4u, 0x00C8u};
    constexpr std::array<std::size_t, 3> angular_velocity_offsets = {0x00CCu, 0x00D0u, 0x00D4u};
    constexpr std::array<std::size_t, 3> local_velocity_offsets = {0x0A5Cu, 0x0A6Cu, 0x0A70u};
    constexpr std::array<std::size_t, 8> control_offsets = {
        0x0A20u, 0x0A24u, 0x0A28u, 0x0A74u,
        0x0A78u, 0x0A88u, 0x0A8Cu, 0x0A9Cu,
    };
    constexpr std::array<std::size_t, 9> unresolved_offsets = {
        0x007Cu, 0x0080u, 0x0084u,
        0x05FCu, 0x0600u, 0x0604u, 0x0608u, 0x060Cu, 0x0610u,
    };
    for (std::size_t index = 0; index < position_offsets.size(); ++index) {
        sample.position[index] = read_float(kart, position_offsets[index]);
        sample.linear_velocity[index] = read_float(kart, linear_velocity_offsets[index]);
        sample.angular_velocity[index] = read_float(kart, angular_velocity_offsets[index]);
        sample.local_velocity[index] = read_float(kart, local_velocity_offsets[index]);
    }
    for (std::size_t index = 0; index < orientation_offsets.size(); ++index) {
        sample.orientation[index] = read_float(kart, orientation_offsets[index]);
        sample.unresolved[index] = read_float(kart, unresolved_offsets[index]);
    }
    for (std::size_t index = 0; index < control_offsets.size(); ++index) {
        sample.control_state[index] = read_float(kart, control_offsets[index]);
    }
    InterlockedExchange(&sample.ready, 1);
}

extern "C" __declspec(naked) void physics_tick_probe() {
    __asm {
        pushfd
        pushad
        sub esp, 528
        lea ebp, dword ptr [esp + 15]
        and ebp, 0FFFFFFF0h
        fxsave [ebp]
        mov eax, dword ptr [esp + 552]
        mov edx, dword ptr [esp + 568]
        push edx
        push eax
        call observe_physics_tick
        add esp, 8
        fxrstor [ebp]
        add esp, 528
        popad
        popfd
        jmp dword ptr [g_tick_trampoline]
    }
}

bool thread_instruction_pointer(HANDLE thread, std::uintptr_t* output) noexcept {
    CONTEXT context{};
    context.ContextFlags = CONTEXT_CONTROL;
    if (GetThreadContext(thread, &context) == FALSE) {
        return false;
    }
    *output = context.Eip;
    return true;
}

bool install_tick_hook() noexcept {
    auto* target = reinterpret_cast<std::uint8_t*>(
        reinterpret_cast<std::uintptr_t>(GetModuleHandleW(nullptr)) + kPhysicsTickRva);
    if (std::memcmp(target, kExpectedTickPrologue.data(), kExpectedTickPrologue.size()) != 0) {
        return false;
    }

    auto* trampoline = static_cast<std::uint8_t*>(VirtualAlloc(
        nullptr, kExpectedTickPrologue.size() + 5, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE));
    if (trampoline == nullptr) {
        return false;
    }
    std::memcpy(trampoline, target, kExpectedTickPrologue.size());
    if (!encode_jump(
            trampoline + kExpectedTickPrologue.size(),
            trampoline + kExpectedTickPrologue.size(),
            target + kExpectedTickPrologue.size())) {
        VirtualFree(trampoline, 0, MEM_RELEASE);
        return false;
    }
    DWORD old_trampoline = 0;
    if (VirtualProtect(
            trampoline,
            kExpectedTickPrologue.size() + 5,
            PAGE_EXECUTE_READ,
            &old_trampoline) == FALSE) {
        VirtualFree(trampoline, 0, MEM_RELEASE);
        return false;
    }
    g_tick_trampoline = trampoline;

    std::vector<HANDLE> suspended;
    const DWORD process_id = GetCurrentProcessId();
    const DWORD current_thread = GetCurrentThreadId();
    HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPTHREAD, 0);
    if (snapshot == INVALID_HANDLE_VALUE) {
        return false;
    }
    THREADENTRY32 entry{};
    entry.dwSize = sizeof(entry);
    if (Thread32First(snapshot, &entry) != FALSE) {
        do {
            if (entry.th32OwnerProcessID != process_id || entry.th32ThreadID == current_thread) {
                continue;
            }
            HANDLE thread = OpenThread(
                THREAD_SUSPEND_RESUME | THREAD_GET_CONTEXT | THREAD_QUERY_INFORMATION,
                FALSE,
                entry.th32ThreadID);
            if (thread == nullptr) {
                continue;
            }
            if (SuspendThread(thread) == static_cast<DWORD>(-1)) {
                CloseHandle(thread);
                continue;
            }
            suspended.push_back(thread);
        } while (Thread32Next(snapshot, &entry) != FALSE);
    }
    CloseHandle(snapshot);

    bool safe = true;
    for (HANDLE thread : suspended) {
        std::uintptr_t instruction = 0;
        if (!thread_instruction_pointer(thread, &instruction)
            || (instruction >= reinterpret_cast<std::uintptr_t>(target)
                && instruction < reinterpret_cast<std::uintptr_t>(target + kExpectedTickPrologue.size()))) {
            safe = false;
            break;
        }
    }

    std::array<std::uint8_t, kExpectedTickPrologue.size()> patch{};
    patch.fill(0x90);
    safe = safe && encode_jump(patch.data(), target, reinterpret_cast<const void*>(&physics_tick_probe));
    if (safe) {
        DWORD old_protection = 0;
        safe = VirtualProtect(target, patch.size(), PAGE_EXECUTE_READWRITE, &old_protection) != FALSE;
        if (safe) {
            std::memcpy(target, patch.data(), patch.size());
            FlushInstructionCache(GetCurrentProcess(), target, patch.size());
            DWORD ignored = 0;
            VirtualProtect(target, patch.size(), old_protection, &ignored);
        }
    }
    for (HANDLE thread : suspended) {
        ResumeThread(thread);
        CloseHandle(thread);
    }
    return safe;
}

bool open_log() noexcept {
    wchar_t path[MAX_PATH] = {};
    const DWORD length = GetModuleFileNameW(g_module, path, MAX_PATH);
    if (length == 0 || length >= MAX_PATH) {
        return false;
    }
    wchar_t* separator = nullptr;
    for (DWORD index = 0; index < length; ++index) {
        if (path[index] == L'\\' || path[index] == L'/') {
            separator = path + index + 1;
        }
    }
    if (separator == nullptr) {
        return false;
    }
    lstrcpyW(separator, L"p5136-original-telemetry.csv");
    g_log = CreateFileW(
        path, GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr,
        CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (g_log == INVALID_HANDLE_VALUE) {
        return false;
    }
    const char header[] =
        "sequence,qpc,client_time_ms,kart,delta_ms,accumulator,accumulator_enabled,accumulator_step,"
        "drift_gate,contact_any,wheel_contact_0,wheel_contact_1,wheel_contact_2,wheel_contact_3,"
        "booster_gauge,speed_gauge,gauge_total,gauge_cap,"
        "pos_x,pos_y,pos_z,orientation_00,orientation_01,orientation_02,orientation_10,orientation_11,"
        "orientation_12,orientation_20,orientation_21,orientation_22,vel_x,vel_y,vel_z,"
        "angular_vel_x,angular_vel_y,angular_vel_z,local_vel_x,local_vel_y,local_vel_z,"
        "control_a20,control_a24,control_a28,control_a74,control_a78,control_a88,control_a8c,control_a9c,"
        "unresolved_07c,unresolved_080,unresolved_084,unresolved_5fc,unresolved_600,unresolved_604,"
        "unresolved_608,unresolved_60c,unresolved_610\r\n";
    DWORD written = 0;
    return WriteFile(g_log, header, static_cast<DWORD>(sizeof(header) - 1), &written, nullptr) != FALSE;
}

DWORD WINAPI writer_thread(void*) noexcept {
    std::size_t read_index = 0;
    DWORD last_flush = GetTickCount();
    for (;;) {
        bool wrote = false;
        while (read_index < g_samples.size()
            && InterlockedCompareExchange(&g_samples[read_index].ready, 0, 0) != 0) {
            const Sample& sample = g_samples[read_index];
            const unsigned long long qpc =
                (static_cast<unsigned long long>(sample.qpc_high) << 32) | sample.qpc_low;
            char line[2048] = {};
            int count = sprintf_s(
                line, sizeof(line),
                "%u,%llu,%u,0x%08X,%u,%.9g,%u,%u,%u,%u,%u,%u,%u,%u,%.9g,%.9g,%.9g,%.9g",
                sample.sequence, qpc, sample.client_time_ms, sample.kart, sample.delta_ms,
                sample.accumulator, sample.accumulator_enabled, sample.accumulator_step,
                sample.drift_gate, sample.contact_any,
                sample.wheel_contacts[0], sample.wheel_contacts[1],
                sample.wheel_contacts[2], sample.wheel_contacts[3],
                sample.booster_gauge, sample.speed_gauge, sample.gauge_total, sample.gauge_cap);
            for (float value : sample.position) {
                count += sprintf_s(line + count, sizeof(line) - static_cast<std::size_t>(count), ",%.9g", value);
            }
            for (float value : sample.orientation) {
                count += sprintf_s(line + count, sizeof(line) - static_cast<std::size_t>(count), ",%.9g", value);
            }
            for (float value : sample.linear_velocity) {
                count += sprintf_s(line + count, sizeof(line) - static_cast<std::size_t>(count), ",%.9g", value);
            }
            for (float value : sample.angular_velocity) {
                count += sprintf_s(line + count, sizeof(line) - static_cast<std::size_t>(count), ",%.9g", value);
            }
            for (float value : sample.local_velocity) {
                count += sprintf_s(line + count, sizeof(line) - static_cast<std::size_t>(count), ",%.9g", value);
            }
            for (float value : sample.control_state) {
                count += sprintf_s(line + count, sizeof(line) - static_cast<std::size_t>(count), ",%.9g", value);
            }
            for (float value : sample.unresolved) {
                count += sprintf_s(line + count, sizeof(line) - static_cast<std::size_t>(count), ",%.9g", value);
            }
            count += sprintf_s(line + count, sizeof(line) - static_cast<std::size_t>(count), "\r\n");
            DWORD written = 0;
            WriteFile(g_log, line, static_cast<DWORD>(count), &written, nullptr);
            ++read_index;
            wrote = true;
        }
        const DWORD now = GetTickCount();
        if (wrote && now - last_flush >= 1000) {
            FlushFileBuffers(g_log);
            last_flush = now;
        }
        Sleep(25);
    }
}

DWORD WINAPI initialize_thread(void*) noexcept {
    if (!open_log()) {
        return 1;
    }
    if (!install_tick_hook()) {
        const char failure[] = "# hook installation failed\r\n";
        DWORD written = 0;
        WriteFile(g_log, failure, static_cast<DWORD>(sizeof(failure) - 1), &written, nullptr);
        FlushFileBuffers(g_log);
        return 2;
    }
    HANDLE writer = CreateThread(nullptr, 0, writer_thread, nullptr, 0, nullptr);
    if (writer == nullptr) {
        return 3;
    }
    SetThreadPriority(writer, THREAD_PRIORITY_BELOW_NORMAL);
    CloseHandle(writer);
    return 0;
}

}  // namespace

BOOL WINAPI DllMain(HINSTANCE instance, DWORD reason, LPVOID) {
    if (reason == DLL_PROCESS_ATTACH) {
        g_module = instance;
        DisableThreadLibraryCalls(instance);
        HANDLE thread = CreateThread(nullptr, 0, initialize_thread, nullptr, 0, nullptr);
        if (thread != nullptr) {
            CloseHandle(thread);
        }
    }
    return TRUE;
}
