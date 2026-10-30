# Môi trường phát triển

Cập nhật M1 ngày 29/10/2026. Lệnh khởi động/dừng/chạy lại Windows được duy trì ở [README](../README.md); bằng chứng thực hiện ở [STATUS](STATUS.md).

## Phiên bản bộ khung

| Phần | Phiên bản / nơi khóa |
| --- | --- |
| Java | Major 21, máy kiểm tra có Oracle JDK 21.0.12; toolchain trong backend/build.gradle |
| Spring Boot | 4.1.2; dependency-management plugin 1.1.7; backend/build.gradle |
| Gradle | Wrapper 9.8.2, có distributionSha256Sum từ máy chủ chính thức |
| Node.js / npm | 24.21.0 / 11.19.0; .node-version và frontend/package.json |
| React / React DOM | 19.3.1; package.json và package-lock.json |
| TypeScript / Vite | 7.0.2 / 8.3.5; package.json và package-lock.json |
| Oxlint / Playwright | 1.89.0 / 1.64.1; package.json và package-lock.json |
| PostgreSQL | 18.6; Compose và Testcontainers dùng cùng digest SHA-256 trong source |

Spring Boot/Wrapper được tạo từ Spring Initializr chính thức. Spring Boot 4.1.2 hỗ trợ Java 21 và Gradle 9.x. [Spring Boot requirements](https://docs.spring.io/spring-boot/system-requirements.html)

Vite và dependency được thử bằng Node/npm ở bảng trên. Không dùng version latest khi chạy dự án; dùng `npm ci` với lockfile. [Vite guide](https://vite.dev/guide/)

PostgreSQL 18 lưu volume ở `/var/lib/postgresql` theo layout image chính thức; không dùng đường dẫn volume của PostgreSQL 17 cho image này. [PostgreSQL image](https://hub.docker.com/_/postgres)

## JDK 21 và JDK 17 cùng tồn tại

`scripts/Use-Java21.ps1` chọn JDK từ JDK21_HOME, JAVA_HOME nếu đúng major, hoặc các thư mục cài phổ biến. Script kiểm tra file release và javac; chỉ thay JAVA_HOME/PATH của tiến trình hiện tại. Không gỡ JDK 17, không sửa PATH hay JAVA_HOME toàn máy.

Dot-source script ở terminal gốc dự án:

```powershell
. .\scripts\Use-Java21.ps1
java -version
javac -version
```

Đặt Project SDK và Gradle JVM trong IDE cùng là 21. Gradle toolchain chọn compile/test; kiểm tra cả Launcher JVM và Daemon JVM bằng Wrapper. GRADLE_USER_HOME được script đặt trong `.work/gradle`, đã được Git bỏ qua. CI dùng Temurin 21; runtime preview dùng JDK 21 đang được chọn. [Gradle toolchains](https://docs.gradle.org/current/userguide/toolchains.html)

## Lưu ý riêng khi chạy bằng Codex trên máy kiểm tra

- Trong sandbox, bộ chuyển hướng Oracle javapath từng lỗi; gọi trực tiếp JDK hoặc đặt JAVA_HOME/PATH qua script đã chạy được.
- Docker Engine, HTTP localhost và npm/Gradle tải dependency cần chạy ngoài sandbox khi bị từ chối quyền socket hoặc DNS. Không coi lỗi sandbox là lỗi cài đặt Docker/JDK; trên terminal Windows của người dùng, chạy các lệnh README bình thường.
- Thư mục gốc ban đầu thuộc CodexSandboxOffline; đã đặt owner riêng thư mục gốc về tài khoản Windows Admin để Git không báo dubious ownership. Không đổi ACL đệ quy hoặc thêm safe.directory toàn máy.
- Docker CLI kiểm tra M1 là 29.9.2, Compose 5.6.1; Engine Linux truy cập được ngoài sandbox. Các phiên bản này khác lần kiểm tra M0; kết quả M1 mới là hiện tại.
- Windows khóa file native đang được Vite dùng và jar đang chạy: dừng Vite/preview trước `dev.ps1 build` hoặc `npm ci`.

## Linux / CI

CI đã cấu hình Node/npm và Java 21, build frontend trước `bash ./gradlew --no-daemon clean build` ở backend; integration test cần Docker. Sau đó CI chạy PostgreSQL Compose, jar có frontend, và Playwright ở cùng địa chỉ backend. Script quản lý preview dành cho Windows; CI dùng lệnh Bash trong workflow.

Chủ dự án cung cấp repository `Davth325/restaurant-order` ngày 30/10/2026; đã cấu hình origin. Kết quả push và Actions thực tế duy trì ở STATUS. Không mô tả cấu hình workflow là CI đã đạt.
