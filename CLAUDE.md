# Dự án: Khung Ngắm (Photo_Art)

Web app hỗ trợ chụp ảnh nghệ thuật: mở camera → (tuỳ chọn) chọn "Chụp gì?" để app tự chọn khung và chỉ chỗ đặt chủ thể → vẽ khung bố cục (một phần ba, lưới vàng, xoắn ốc vàng, đường chéo, tam giác vàng, đối xứng) + đo sáng + thước cân bằng → chụp → gợi ý gam màu kiểu film, trích bảng màu → lưu ảnh. HTML/CSS/JS thuần, **không framework, không build step, không thư viện ngoài** (chỉ font Be Vietnam Pro từ Google Fonts). Không có backend — mọi xử lý ảnh chạy trong trình duyệt, ảnh không rời máy người dùng.

## Thông tin dự án
- Link dùng: **https://gaudilac.github.io/khung-ngam/** (GitHub Pages, repo `gaudilac/khung-ngam`, nhánh `main`, thư mục gốc).
- Deploy: máy **không chạy được git** (license Xcode chưa chấp nhận) → đẩy từng file bằng `gh api -X PUT repos/gaudilac/khung-ngam/contents/<file>` (file đã có phải kèm `-f sha=<sha hiện tại>`, commit message kết bằng dòng `Co-Authored-By`). Pages tự dựng lại sau ~1 phút; chờ `gh api repos/gaudilac/khung-ngam/pages/builds/latest -q .status` = `built`. Kiểm: `curl -sL https://gaudilac.github.io/khung-ngam/app.js | grep -c "<chuỗi vừa sửa>"` phải ra ≥ 1. Báo cáo cho user nêu rõ link đã nhận bản mới chưa.
- ⚠️ Repo **public** — ai cũng đọc được code. Không đưa secret, key API, ảnh cá nhân của user vào repo.
- Camera chỉ mở được qua **https hoặc localhost**. Mở qua IP mạng LAN (`http://192.168…`) thì không có camera — muốn thử trên điện thoại phải dùng link GitHub.
- Chạy local: `python3 -m http.server 8765` trong `Photo_Art/` → http://localhost:8765.

## Nguyên tắc làm việc

### 1. Hiểu code thật trước khi code
**Đừng giả định. Đừng giấu sự mơ hồ. Nêu rõ trade-off.**
- Đọc đúng hàm liên quan trước khi sửa: hình học khung ở `cropRect`/`sourceRect`/`drawGuide` (app.js), màu ở `buildLut`/`apply` (grade.js).
- Thao tác trên phần mềm/trình duyệt bên thứ ba (Safari iOS, cài đặt quyền camera, GitHub Pages) phải tra tài liệu chính thức, hoặc nói rõ là chưa chắc — không đoán.
- Điều gì chưa rõ thì dừng lại, gọi tên điều chưa rõ, và hỏi. Không tự thu hẹp phạm vi yêu cầu rồi báo sau.

### 2. Tối giản
**Lượng code tối thiểu giải quyết đúng vấn đề. Không có gì "phòng hờ".**
- Không thêm framework, bundler, thư viện CDN. Cần thư viện thì hỏi user trước.
- Không thêm tính năng ngoài yêu cầu. Danh sách preset giữ khoảng 12–15: nhiều hơn thì người chụp không chọn nổi — thêm một cái nên cân nhắc bỏ một cái.

### 3. Sửa như phẫu thuật
**Chỉ đụng chỗ phải đụng. Chỉ dọn rác do chính mình tạo ra.**
- Match style hiện có: comment tiếng Việt ngắn giải thích *vì sao*, chuỗi giao diện tiếng Việt, nhiều lệnh ngắn trên một dòng.
- Màu giao diện chỉ đặt qua biến `--…` trong `:root` của index.html.
- Xoá biến/hàm mà thay đổi CỦA MÌNH làm mồ côi; dead code có sẵn thì báo lại, không tự xoá.

### 4. Chạy thật mới tin
**Định nghĩa tiêu chí thành công trước. Lặp đến khi xác minh được.**
- `node tests/grade.test.js` — kiểm bộ màu không cần trình duyệt (preset Gốc giữ nguyên pixel, preset khác phải đổi, đen trắng phải ra xám, gợi ý có lý do, nhận diện màu bổ túc).
- `NODE_PATH="../web_task/node_modules" node tests/assist.js` (cần server 8765) — camera giả là **video tự dựng hoa văn trôi sang phải** với tốc độ biết trước: kiểm chấm bám chủ thể trôi đúng hướng/đúng khoảng cách, câu chỉ hướng lia máy đúng chiều, lựa chọn chân trời, nút ✕, toàn màn hình phủ kín, nút Lưu vào Ảnh hiện ngay và luồng Safari chặn → bấm lại.
- `NODE_PATH="../web_task/node_modules" node tests/xoay-luu.js` (chạy sau assist.js vì dùng chung video thử) — chụp 2 tấm liền, ảnh lưu phải khác nhau; xoay ngang/dọc bằng đổi khổ (cùng `isMobile` nên không tải lại trang): khung đổi chiều, nút chụp trong màn, màn chỉnh màu ngang đủ lớn.
- `NODE_PATH="../web_task/node_modules" node tests/e2e.js` (cần server 8765 đang chạy) — puppeteer + camera giả của Chrome: mở camera, đổi khung, thước cân bằng giả lập cả dấu Android lẫn iOS, chụp, chỉnh màu, tải ảnh, tải ảnh có sẵn, giữ-để-so. Ảnh chụp màn hình ra `$OUT` (mặc định `$TMPDIR/khung-ngam-test`) — **xem ảnh**, đừng chỉ đọc chữ PASS.
- Thêm test mới thì phá code cho nó FAIL một lần để chắc test kiểm được thật.
- Chạy thẳng trên link thật: thêm `URL=https://gaudilac.github.io/khung-ngam/` trước lệnh test.
- Đổi giao diện thì chụp ở cả khổ điện thoại (390×844) lẫn máy tính (1366×820).
- Thứ chưa test được bằng puppeteer (cảm biến nghiêng thật, iOS, camera thật, Lưu vào Ảnh) → ghi vào checklist test tay cho user, nói rõ là chưa kiểm.

## Nguyên tắc chuyên môn (giữ khi thêm/sửa tính năng)
- **Thấy gì lưu nấy**: phần tối bên ngoài khung chính là phần bị cắt. Ảnh lưu ra = đúng vùng trong khung. Đổi cách vẽ khung thì phải đổi `sourceRect` theo.
- **Preview và xuất ảnh dùng chung một đường xử lý** (`Grade.apply` với cùng tham số). Không viết hiệu ứng riêng cho preview (CSS filter…) — kết quả lưu ra sẽ khác cái user đã chọn.
- **Mỗi preset phải có câu "dùng khi nào"** (`note`) và mỗi gợi ý phải có lý do (`why`). App đóng vai người hướng dẫn chụp, không phải hộp bộ lọc.
- Tô màu vùng tối/vùng sáng (`splitS`/`splitH`) phải **giữ nguyên độ sáng** (`toneVec` trừ luminance) — chỉ đổi sắc, không làm ảnh sáng/tối đi.
- Giao diện **xám trung tính có chủ đích**: nền có màu làm mắt đánh giá sai màu ảnh. Màu nhấn duy nhất là `--accent`.
- Nét khung vẽ đôi (viền tối mờ + nét sáng) để nhìn được trên cả trời trắng lẫn bóng tối.
- **Chỉ hướng theo chiều MÁY, không theo chiều chủ thể**: chủ thể cần sang phải trong khung → "lia máy sang trái"; cần xuống → "ngửa máy lên". Camera trước (lật gương) chỉ nói "theo mũi tên".
- Khung hướng dẫn không được che mục tiêu: bước 2 chỉ còn câu chỉ hướng, mẹo chuyên môn chỉ ở bước 1.

## Cấu trúc file
- `index.html` — toàn bộ CSS (trong `<style>`) + markup của hai màn: `#cam` (chụp) và `#edit` (chỉnh màu). Màn đang hiện có class `.on`.
- `app.js` — một IIFE, theo thứ tự: danh sách khung `GUIDES` + tỉ lệ `RATIOS` → vẽ khung (`cropRect`, `drawGuide`, `SPIRAL`) → camera (`startCamera`, `setupPro` zoom/bù sáng) → đo sáng (`meter`, `lumaStats`, `drawHist`) → thước cân bằng (`onMotion`, `levelLoop`) → chụp (`sourceRect`, `capture`) → màn chỉnh màu (`openEditor`, `buildPresets`, `render`, bảng màu) → xuất ảnh (`exportBlob`, dải bảng màu tuỳ chọn).
- `grade.js` — `window.Grade`, **không đụng DOM** (chạy được trong Node): `PRESETS`, `analyze` (thống kê ảnh), `suggest` (chấm điểm preset), `resolve` (gộp preset + chỉnh tay), `apply` (xử lý pixel), `palette` (k-means hạt giống cố định), `harmony` (đọc quan hệ màu).
- `tests/` — `grade.test.js`, `e2e.js`, `assist.js`, `xoay-luu.js`.
- `window.KN = { st, crop }` — móc trạng thái cho test đọc, đừng xoá.

### "Chụp gì?" (SCENES trong app.js)
Mỗi cảnh: `guide` + `ratio` + `land` (`'screen'` = theo chiều màn hình) + `place` (câu bước 1) + `tip` + `target(R, opt, p)` trả `{x, y}` (`null` = trục đó không xét; chân trời là `line: true`, chỉ xét y). `level: true` thì tự bật thước. Hai bước: **place** (chạm/kéo chỉ chủ thể) → thả tay `lockOn()` chụp mẫu → **guide** (bám + chỉ hướng, rung khi khớp).
Bám chủ thể (`grab`/`patchAt`/`trackPoint`): khung hình thu về 160px xám, so khớp mảng 17×17 **đã trừ độ sáng trung bình** (chịu được máy tự đổi phơi sáng), tìm quanh ±12px (±20 khi mất dấu), sai số trung bình > 22 = mất dấu, < 10 thì cập nhật mẫu 15%. Mẫu quá trơn (`std < 7`, vd trời xanh) thì báo người dùng chọn chỗ có chi tiết. Chân trời bám 2 điểm trên vạch.

### Thêm khung bố cục mới
Thêm một mục vào `GUIDES` (`id`, `name`, `variants`, `tip`) + một nhánh trong `drawGuide`. `tip` viết như lời thợ ảnh: đặt chủ thể ở đâu, hợp cảnh gì. Có biến thể xoay/lật thì `variants > 1` — chạm lại chip để đổi.

### Thêm preset màu mới
Thêm vào `PRESETS` (`id`, `name`, `note`, `p`) + một dòng chấm điểm trong `suggest` kèm `why`. Tham số `p` có sẵn: `ev, temp, tint, contrast, fade, lift, gain, gamma, hiRoll, sat, vib, splitS, splitH, to, greenDesat, bw, vig, grain`. Cập nhật số preset trong `tests/e2e.js` (đang kiểm 14).

## Bẫy đã biết
- **Lưu vào Ảnh từng trả ẢNH CŨ** (user báo): ảnh xuất sẵn `ready` được nhận bằng `shareSig`, mà chữ ký chỉ có gam màu/độ đậm/chỉnh tay/bề rộng → tấm mới cùng gam + cùng cỡ bị coi là tấm cũ. Giờ chữ ký có `ed.shot` (tăng mỗi lần `openEditor`) và `openEditor` xoá `ready`. Thêm bộ nhớ đệm nào cho ảnh thì khoá theo `ed.shot`.
- **Chiều khung theo chiều máy**: `st.landscape = isLand()` lúc mở trang, lúc chọn cảnh, và mỗi khi xoay (`onResize`). Đang hướng dẫn mà xoay máy thì làm lại từ bước 1 (toạ độ chủ thể cũ hết đúng). Bấm "Dọc/Ngang" tay vẫn được, tới lần xoay sau thì theo máy.
- **Điện thoại cầm ngang có bố cục riêng** (media query `(orientation: landscape) and (max-height: 560px)` ở cuối `<style>`, JS đọc cùng điều kiện qua `landMQ`): nút chụp là cột phải, `.controls` thành `display: contents` để tỉ lệ nổi đáy ảnh, `insets()` né thanh chip trên + hàng tỉ lệ dưới. Đổi media query thì đổi cả `landMQ`. Màn chỉnh màu dùng bố cục 2 cột như máy tính.
- **Nút lưu từng nằm dưới đáy vùng cuộn** nên user không thấy → giờ ở `.savebar` cố định ngoài `.panel`. Đừng đưa nút hành động chính vào vùng cuộn.
- **iPad đời mới tự xưng "Macintosh" trong userAgent** → nhận điện thoại/máy tính bảng bằng `navigator.maxTouchPoints > 0`, không dò userAgent.
- **Safari chỉ mở bảng chia sẻ ngay sau cú chạm**; xuất ảnh lớn mất 1–2 giây có thể làm mất cú chạm → `NotAllowedError`. Nút Lưu giữ ảnh đã xuất (`ready`, khoá theo `shareSig`) và đổi chữ "chạm lần nữa" — lần hai mở ngay. Chưa kiểm trên iPhone thật xem lần một có bị chặn không.
- **iPhone không có Fullscreen API cho trang** → nút toàn màn hình chỉ đổi bố cục (thanh nổi đè ảnh) + nhắc "Thêm vào MH chính". Android/máy tính thì gọi `requestFullscreen` thật.
- Ảnh camera giả chỉ có vài mảng màu phẳng → k-means có thể ra < 5 màu; test chỉ đòi ≥ 3.
- **Hàng chip `white-space: nowrap` làm cột grid phình rộng hơn màn hình** → khung ngắm lệch sang phải. `.screen.on` phải có `grid-template-columns: minmax(0, 1fr)`.
- **`justify-content: center` trên hàng cuộn ngang cắt mất phần tử đầu** khi tràn (không cuộn tới được). Dùng `margin-left:auto` cho con đầu + `margin-right:auto` cho con cuối (`.ratios`).
- **Đo kích thước khi màn còn `display:none` ra toàn 0.** `buildPresets` chạy trước khi `#edit` hiện → cuộn tới preset gợi ý phải đợi `requestAnimationFrame`.
- **Gia tốc kế iOS và Android ngược dấu nhau.** `onMotion` chuẩn hoá bằng cách lật vector sao cho "lên" luôn hướng lên đỉnh màn hình — đừng bỏ dòng `if (sy < 0)`. iOS còn bắt `DeviceMotionEvent.requestPermission()` từ một cú chạm. Khi cầm ngang trên iPhone thật **chưa kiểm**.
- **Camera trước hiển thị lật gương nhưng ảnh lưu ra KHÔNG lật** (giống mặc định iPhone). `sourceRect` tính toạ độ ngược khi `video.mirror`.
- **Safari iOS từ chối canvas quá ~16 MP** → ảnh chọn từ thư viện bị thu về 4096 cạnh dài.
- **puppeteer `setViewport` đổi `isMobile` là trang TẢI LẠI** — ảnh chụp "desktop" sau đó thực ra là màn camera mới mở. Muốn test khổ khác thì mở trang mới.
- Nút "Lưu vào Ảnh / Chia sẻ" chỉ hiện trên điện thoại: máy tính cũng báo `canShare` nhưng bảng chia sẻ của macOS/Windows không lưu vào thư viện ảnh.
- macOS không có lệnh `timeout` — đừng bọc lệnh test bằng nó.
