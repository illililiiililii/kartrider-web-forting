#include <windows.h>

#include <array>
#include <cstdint>
#include <cstdio>
#include <cwchar>
#include <string>

namespace {

struct WindowSearch {
    DWORD process_id = 0;
    HWND window = nullptr;
};

BOOL CALLBACK find_window(HWND window, LPARAM parameter) {
    auto* search = reinterpret_cast<WindowSearch*>(parameter);
    DWORD owner = 0;
    GetWindowThreadProcessId(window, &owner);
    if (owner == search->process_id && IsWindowVisible(window) != FALSE
        && GetWindow(window, GW_OWNER) == nullptr) {
        search->window = window;
        return FALSE;
    }
    return TRUE;
}

class File {
public:
    explicit File(HANDLE value = INVALID_HANDLE_VALUE) noexcept : value_(value) {}
    ~File() { if (value_ != INVALID_HANDLE_VALUE) CloseHandle(value_); }
    File(const File&) = delete;
    File& operator=(const File&) = delete;
    [[nodiscard]] bool valid() const noexcept { return value_ != INVALID_HANDLE_VALUE; }
    [[nodiscard]] HANDLE get() const noexcept { return value_; }
private:
    HANDLE value_;
};

unsigned long long qpc_now() noexcept {
    LARGE_INTEGER value{};
    QueryPerformanceCounter(&value);
    return static_cast<unsigned long long>(value.QuadPart);
}

bool append_line(HANDLE file, const char* phase, WORD key, bool down, unsigned sent) noexcept {
    char buffer[256] = {};
    const int count = sprintf_s(
        buffer, sizeof(buffer), "%llu,%s,0x%02X,%s,%u\r\n",
        qpc_now(), phase, static_cast<unsigned>(key), down ? "down" : "up", sent);
    if (count <= 0) return false;
    DWORD written = 0;
    return WriteFile(file, buffer, static_cast<DWORD>(count), &written, nullptr) != FALSE
        && written == static_cast<DWORD>(count);
}

bool send_key(HANDLE log, const char* phase, WORD key, bool down) noexcept {
    const UINT scan = MapVirtualKeyW(key, MAPVK_VK_TO_VSC_EX);
    if (scan == 0) return false;
    INPUT input{};
    input.type = INPUT_KEYBOARD;
    input.ki.wScan = static_cast<WORD>(scan & 0xFFu);
    input.ki.dwFlags = KEYEVENTF_SCANCODE;
    if ((scan & 0xFF00u) != 0) input.ki.dwFlags |= KEYEVENTF_EXTENDEDKEY;
    if (!down) input.ki.dwFlags |= KEYEVENTF_KEYUP;
    const UINT sent = SendInput(1, &input, sizeof(input));
    return append_line(log, phase, key, down, sent) && sent == 1;
}

bool click_client_point(HANDLE log, HWND window, long x, long y) noexcept {
    POINT point{x, y};
    if (ClientToScreen(window, &point) == FALSE || SetCursorPos(point.x, point.y) == FALSE) {
        return false;
    }
    const LPARAM client_point = static_cast<LPARAM>(
        (static_cast<unsigned long>(y) & 0xFFFFu) << 16
        | (static_cast<unsigned long>(x) & 0xFFFFu));
    PostMessageW(window, WM_MOUSEMOVE, 0, client_point);
    PostMessageW(window, WM_LBUTTONDOWN, MK_LBUTTON, client_point);
    INPUT input{};
    input.type = INPUT_MOUSE;
    input.mi.dwFlags = MOUSEEVENTF_LEFTDOWN;
    const UINT down = SendInput(1, &input, sizeof(INPUT));
    append_line(log, "ui-click-down", 0, true, down);
    Sleep(100);
    PostMessageW(window, WM_LBUTTONUP, 0, client_point);
    input.mi.dwFlags = MOUSEEVENTF_LEFTUP;
    const UINT up = SendInput(1, &input, sizeof(INPUT));
    append_line(log, "ui-click-up", 0, false, up);
    return down == 1 && up == 1;
}

void release_all(HANDLE log, const char* phase) noexcept {
    constexpr std::array<WORD, 6> keys = {
        VK_UP, VK_DOWN, VK_LEFT, VK_RIGHT, VK_SHIFT, VK_CONTROL,
    };
    for (WORD key : keys) {
        send_key(log, phase, key, false);
    }
}

bool focus_window(HWND window) noexcept {
    ShowWindow(window, SW_RESTORE);
    SetWindowPos(window, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
    SetWindowPos(window, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
    BringWindowToTop(window);
    return SetForegroundWindow(window) != FALSE;
}

bool run_sequence(HANDLE log) noexcept {
    release_all(log, "initial-release");
    send_key(log, "reset-to-track", static_cast<WORD>('R'), true);
    Sleep(100);
    send_key(log, "reset-to-track", static_cast<WORD>('R'), false);
    Sleep(3000);

    if (!send_key(log, "straight-4s", VK_UP, true)) return false;
    Sleep(4000);

    if (!send_key(log, "left-drift-1s", VK_LEFT, true)) return false;
    if (!send_key(log, "left-drift-1s", VK_SHIFT, true)) return false;
    Sleep(1000);
    send_key(log, "left-drift-1s", VK_SHIFT, false);
    send_key(log, "left-drift-1s", VK_LEFT, false);

    if (!send_key(log, "recovery-2s", VK_UP, true)) return false;
    Sleep(2000);

    if (!send_key(log, "right-drift-1s", VK_RIGHT, true)) return false;
    if (!send_key(log, "right-drift-1s", VK_SHIFT, true)) return false;
    Sleep(1000);
    send_key(log, "right-drift-1s", VK_SHIFT, false);
    send_key(log, "right-drift-1s", VK_RIGHT, false);

    Sleep(1000);
    send_key(log, "booster-200ms", VK_CONTROL, true);
    Sleep(200);
    send_key(log, "booster-200ms", VK_CONTROL, false);
    Sleep(3000);
    send_key(log, "straight-end", VK_UP, false);

    send_key(log, "brake-1500ms", VK_DOWN, true);
    Sleep(1500);
    send_key(log, "brake-1500ms", VK_DOWN, false);
    release_all(log, "final-release");
    FlushFileBuffers(log);
    return true;
}

}  // namespace

int wmain(int argc, wchar_t** argv) {
    SetProcessDPIAware();
    SetThreadDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    if (argc != 3 && argc != 5 && argc != 6) {
        std::fwprintf(
            stderr,
            L"usage: p5136-input-driver <pid> <event-csv> "
            L"[press <virtual-key> | click <client-x> <client-y>]\n");
        return 2;
    }
    wchar_t* end = nullptr;
    const unsigned long parsed = std::wcstoul(argv[1], &end, 10);
    if (end == argv[1] || *end != L'\0' || parsed == 0 || parsed > MAXDWORD) return 3;

    WindowSearch search{static_cast<DWORD>(parsed), nullptr};
    EnumWindows(find_window, reinterpret_cast<LPARAM>(&search));
    if (search.window == nullptr) {
        std::fwprintf(stderr, L"no visible top-level window for pid=%lu\n", parsed);
        return 4;
    }

    File log(CreateFileW(
        argv[2], GENERIC_WRITE, FILE_SHARE_READ, nullptr, CREATE_ALWAYS,
        FILE_ATTRIBUTE_NORMAL, nullptr));
    if (!log.valid()) {
        std::fwprintf(stderr, L"cannot create event log: %lu\n", GetLastError());
        return 5;
    }
    const char header[] = "qpc,phase,key,event,sendinput_count\r\n";
    DWORD written = 0;
    if (WriteFile(log.get(), header, static_cast<DWORD>(sizeof(header) - 1), &written, nullptr) == FALSE) {
        return 6;
    }

    if (!focus_window(search.window)) {
        std::fwprintf(stderr, L"warning: SetForegroundWindow failed: %lu\n", GetLastError());
    }
    Sleep(750);
    if (argc == 6) {
        if (_wcsicmp(argv[3], L"click") != 0) return 7;
        wchar_t* x_end = nullptr;
        wchar_t* y_end = nullptr;
        const long x = std::wcstol(argv[4], &x_end, 10);
        const long y = std::wcstol(argv[5], &y_end, 10);
        if (x_end == argv[4] || *x_end != L'\0' || y_end == argv[5] || *y_end != L'\0') return 8;
        const bool clicked = click_client_point(log.get(), search.window, x, y);
        FlushFileBuffers(log.get());
        return clicked ? 0 : 9;
    }
    if (argc == 5) {
        if (_wcsicmp(argv[3], L"press") != 0) return 7;
        wchar_t* key_end = nullptr;
        const unsigned long parsed_key = std::wcstoul(argv[4], &key_end, 0);
        if (key_end == argv[4] || *key_end != L'\0' || parsed_key > 0xFFu) return 8;
        const WORD key = static_cast<WORD>(parsed_key);
        const bool down = send_key(log.get(), "ui-press", key, true);
        Sleep(100);
        const bool up = send_key(log.get(), "ui-press", key, false);
        FlushFileBuffers(log.get());
        return down && up ? 0 : 9;
    }
    const bool ok = run_sequence(log.get());
    release_all(log.get(), "emergency-release");
    return ok ? 0 : 7;
}
