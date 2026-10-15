# Mẫu tích hợp (SDK sample)

Ba cách đưa VNChat vào sản phẩm của đối tác. Giao thức và quy tắc bảo mật: [`docs/embed-webview-architecture.md`](../../docs/embed-webview-architecture.md).

| Cách | Khi nào | Trang mẫu |
| :--- | :--- | :--- |
| Widget hỗ trợ khách (`vnchat-widget.js`) | website bán hàng/landing cần chat với nhân viên hỗ trợ | `index.html` |
| Nhúng toàn bộ app (`<iframe src=…/embed>`) | CRM/dashboard nội bộ muốn có hộp thư VNChat | `embed.html` |
| WebView native (`/embed` hoặc `/compact`) | app iOS/Android/React Native | đoạn mã bên dưới |

## Chạy thử ở máy dev (cross-site thật)

```bash
# 1. VNChat: thêm vào .env.development.local (gitignore) dòng
#    VITE_EMBED_PARENT_ORIGINS=http://127.0.0.1:5180
npm run dev                                   # http://localhost:5174

# 2. Trang host ở site khác (127.0.0.1 ≠ localhost với trình duyệt)
node examples/host/serve.mjs                  # http://127.0.0.1:5180
```

Mở `http://127.0.0.1:5180` (widget) hoặc `http://127.0.0.1:5180/embed.html` (app đầy đủ). Đổi origin VNChat bằng
`VNCHAT_ORIGIN=https://chat.example.vn node examples/host/serve.mjs`.

## 1. Widget

```html
<script src="https://chat.example.vn/vnchat-widget.js" async
        data-site-id="shop-01" data-theme="system" data-locale="vi" data-placement="bottom-right"></script>
<script>
  window.addEventListener("load", () => {
    VNChat.on("unread", (n) => console.log("chưa đọc", n));
    document.querySelector("#help").onclick = () => VNChat.open();
  });
</script>
```

API: `VNChat.open()`, `VNChat.close()`, `VNChat.setTheme("light" | "dark" | "system")`, `VNChat.setLocale("vi" | "en")`,
`VNChat.on("ready" | "open" | "close" | "unread", fn)`. `data-site-id` là nhãn công khai (hiện cho nhân viên hỗ trợ), không
phải khoá bí mật.

## 2. Iframe `/embed`

```html
<iframe id="vnchat" title="VNChat" src="https://chat.example.vn/embed" allow="clipboard-write"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
        referrerpolicy="strict-origin-when-cross-origin"></iframe>
<script>
  const ORIGIN = "https://chat.example.vn";
  const frame = document.getElementById("vnchat");
  window.addEventListener("message", (e) => {
    if (e.origin !== ORIGIN || e.source !== frame.contentWindow) return;     // bắt buộc cả hai
    const msg = e.data;
    if (!msg || msg.source !== "vnchat-embed" || msg.v !== 1) return;
    if (msg.type === "unread:change") updateBadge(msg.count);
    if (msg.type === "navigate:external") window.open(msg.url, "_blank", "noopener");
  });
  const send = (m) => frame.contentWindow.postMessage({ source: "vnchat-host", v: 1, ...m }, ORIGIN); // không dùng "*"
  // send({ type: "theme:set", theme: "dark" }); send({ type: "navigate", route: "/embed/search" });
</script>
```

Người dùng đăng nhập **trong khung** (Bearer, token chỉ nằm trong storage của khung). Không truyền token qua URL hay
`postMessage`. Origin trang host phải nằm trong `VITE_EMBED_PARENT_ORIGINS` **và** header `frame-ancestors`
([`deploy/README.md`](../../deploy/README.md)).

## 3. WebView native

Inject đối tượng bridge **trước khi trang tải**, chỉ cho WebView điều hướng trong origin VNChat (link ngoài đi qua
`navigate:external`). Host → chat luôn qua `window.vnchatHost.receive(msg)`; VNChat kiểm tra shape giống §3.1.

**Android (Kotlin)**

```kotlin
webView.settings.javaScriptEnabled = true
webView.settings.domStorageEnabled = true
webView.addJavascriptInterface(object {
    @JavascriptInterface fun postMessage(json: String) {
        val msg = JSONObject(json)                       // { source: "vnchat-embed", v: 1, type, ... }
        if (msg.optString("type") == "navigate:external")
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(msg.getString("url"))))
    }
}, "VNChatAndroid")
webView.webViewClient = object : WebViewClient() {
    override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest) =
        r.url.host != "chat.example.vn"                  // chỉ ở lại trong VNChat
}
webView.webChromeClient = object : WebChromeClient() {
    override fun onShowFileChooser(v: WebView, cb: ValueCallback<Array<Uri>>, p: FileChooserParams): Boolean {
        /* mở picker rồi gọi cb.onReceiveValue(...) – cần cho đính kèm tệp */ return true
    }
}
// back cứng: if (webView.canGoBack()) webView.goBack() else finish()
webView.evaluateJavascript("""window.vnchatHost?.receive({source:"vnchat-host",v:1,type:"theme:set",theme:"dark"})""", null)
webView.loadUrl("https://chat.example.vn/embed")
```

**iOS (Swift, WKWebView)**

```swift
let controller = WKUserContentController()
controller.add(self, name: "vnchat")                     // → window.webkit.messageHandlers.vnchat
let config = WKWebViewConfiguration(); config.userContentController = controller
let webView = WKWebView(frame: .zero, configuration: config)
webView.allowsBackForwardNavigationGestures = true

func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
    guard let msg = m.body as? [String: Any], msg["source"] as? String == "vnchat-embed" else { return }
    if msg["type"] as? String == "navigate:external", let s = msg["url"] as? String, let url = URL(string: s) {
        UIApplication.shared.open(url)
    }
}
webView.evaluateJavaScript(#"window.vnchatHost?.receive({source:"vnchat-host",v:1,type:"locale:set",locale:"en"})"#)
```

**React Native (`react-native-webview`)**

```tsx
<WebView
  source={{ uri: "https://chat.example.vn/embed" }}
  originWhitelist={["https://chat.example.vn"]}
  onMessage={(e) => {
    const msg = JSON.parse(e.nativeEvent.data);
    if (msg.source === "vnchat-embed" && msg.type === "navigate:external") Linking.openURL(msg.url);
  }}
  ref={ref}
/>
// ref.current?.injectJavaScript(`window.vnchatHost?.receive(${JSON.stringify({ source: "vnchat-host", v: 1, type: "theme:set", theme: "dark" })}); true;`)
```

`ready` đến một lần sau khi trang tải; dùng nó để gửi theme/ngôn ngữ ban đầu. Viewport: không khoá zoom; nếu WebView
không co `visualViewport` khi bàn phím mở, gửi `viewport:set { height }`.
