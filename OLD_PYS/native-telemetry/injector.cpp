#include <windows.h>
#include <tlhelp32.h>

#include <cstdint>
#include <cstdio>
#include <cwchar>
#include <string>
#include <vector>

namespace {

class Handle {
public:
    explicit Handle(HANDLE value = nullptr) noexcept : value_(value) {}
    ~Handle() { if (valid()) CloseHandle(value_); }
    Handle(const Handle&) = delete;
    Handle& operator=(const Handle&) = delete;
    [[nodiscard]] bool valid() const noexcept { return value_ != nullptr && value_ != INVALID_HANDLE_VALUE; }
    [[nodiscard]] HANDLE get() const noexcept { return value_; }
private:
    HANDLE value_;
};

std::wstring absolute_path(const wchar_t* input) {
    std::vector<wchar_t> buffer(32768);
    const DWORD length = GetFullPathNameW(input, static_cast<DWORD>(buffer.size()), buffer.data(), nullptr);
    return length == 0 || length >= buffer.size() ? std::wstring{} : std::wstring(buffer.data(), length);
}

std::uintptr_t remote_module_base(DWORD process_id, const wchar_t* module_name) {
    Handle snapshot(CreateToolhelp32Snapshot(TH32CS_SNAPMODULE | TH32CS_SNAPMODULE32, process_id));
    if (!snapshot.valid()) return 0;
    MODULEENTRY32W entry{};
    entry.dwSize = sizeof(entry);
    if (Module32FirstW(snapshot.get(), &entry) == FALSE) return 0;
    do {
        if (_wcsicmp(entry.szModule, module_name) == 0) {
            return reinterpret_cast<std::uintptr_t>(entry.modBaseAddr);
        }
    } while (Module32NextW(snapshot.get(), &entry) != FALSE);
    return 0;
}

std::uintptr_t remote_load_library(DWORD process_id) {
    const HMODULE local_kernel = GetModuleHandleW(L"kernel32.dll");
    const FARPROC local_function = GetProcAddress(local_kernel, "LoadLibraryW");
    MEMORY_BASIC_INFORMATION memory{};
    if (local_function == nullptr
        || VirtualQuery(reinterpret_cast<const void*>(local_function), &memory, sizeof(memory)) != sizeof(memory)) {
        return 0;
    }
    const auto owner = static_cast<HMODULE>(memory.AllocationBase);
    wchar_t owner_path[MAX_PATH] = {};
    if (GetModuleFileNameW(owner, owner_path, MAX_PATH) == 0) return 0;
    const wchar_t* owner_name = wcsrchr(owner_path, L'\\');
    owner_name = owner_name == nullptr ? owner_path : owner_name + 1;
    const std::uintptr_t remote_owner = remote_module_base(process_id, owner_name);
    if (remote_owner == 0) return 0;
    return remote_owner + reinterpret_cast<std::uintptr_t>(local_function)
        - reinterpret_cast<std::uintptr_t>(owner);
}

bool target_is_kartrider(HANDLE process) {
    std::vector<wchar_t> path(32768);
    DWORD length = static_cast<DWORD>(path.size());
    if (QueryFullProcessImageNameW(process, 0, path.data(), &length) == FALSE) return false;
    const wchar_t* name = wcsrchr(path.data(), L'\\');
    name = name == nullptr ? path.data() : name + 1;
    return _wcsicmp(name, L"KartRider.exe") == 0 || _wcsicmp(name, L"KartRiderU.exe") == 0;
}

}  // namespace

int wmain(int argc, wchar_t** argv) {
    if (argc != 3) {
        std::fwprintf(stderr, L"usage: p5136-telemetry-injector <pid> <dll>\n");
        return 2;
    }
    wchar_t* end = nullptr;
    const unsigned long parsed = std::wcstoul(argv[1], &end, 10);
    if (end == argv[1] || *end != L'\0' || parsed == 0 || parsed > MAXDWORD) return 3;
    const DWORD process_id = static_cast<DWORD>(parsed);
    const std::wstring dll = absolute_path(argv[2]);
    if (dll.empty() || GetFileAttributesW(dll.c_str()) == INVALID_FILE_ATTRIBUTES) return 4;

    constexpr DWORD access = PROCESS_CREATE_THREAD | PROCESS_QUERY_INFORMATION
        | PROCESS_VM_OPERATION | PROCESS_VM_WRITE | PROCESS_VM_READ;
    Handle process(OpenProcess(access, FALSE, process_id));
    if (!process.valid()) {
        std::fwprintf(stderr, L"OpenProcess failed: %lu\n", GetLastError());
        return 5;
    }
    if (!target_is_kartrider(process.get())) {
        std::fwprintf(stderr, L"target is not KartRider.exe\n");
        return 6;
    }

    const std::uintptr_t load_library = remote_load_library(process_id);
    if (load_library == 0) return 7;
    const SIZE_T bytes = (dll.size() + 1) * sizeof(wchar_t);
    void* remote_path = VirtualAllocEx(process.get(), nullptr, bytes, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
    if (remote_path == nullptr) return 8;
    SIZE_T written = 0;
    if (WriteProcessMemory(process.get(), remote_path, dll.c_str(), bytes, &written) == FALSE || written != bytes) {
        VirtualFreeEx(process.get(), remote_path, 0, MEM_RELEASE);
        return 9;
    }
    Handle thread(CreateRemoteThread(
        process.get(), nullptr, 0,
        reinterpret_cast<LPTHREAD_START_ROUTINE>(load_library), remote_path, 0, nullptr));
    if (!thread.valid()) {
        VirtualFreeEx(process.get(), remote_path, 0, MEM_RELEASE);
        return 10;
    }
    const DWORD wait = WaitForSingleObject(thread.get(), 15000);
    DWORD result = 0;
    GetExitCodeThread(thread.get(), &result);
    VirtualFreeEx(process.get(), remote_path, 0, MEM_RELEASE);
    if (wait != WAIT_OBJECT_0 || result == 0) return 11;
    std::wprintf(L"loaded telemetry DLL into pid=%lu module=0x%08lX\n", process_id, result);
    return 0;
}
