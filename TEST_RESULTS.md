# Проверки первой итерации — 2026-10-01

**Историческое свидетельство первого Mac/Android этапа, не текущий сводный статус.** Число тестов, роль direct APK, отсутствие Cloudflare и непроверенность AIUI ниже относятся к тому этапу. Последующие AIUI/backend/cloud результаты и незакрытая физическая приёмка нового UX сведены в [setup status](docs/setup-status.md). Этот bootstrap не повторял runtime/physical tests.

## Итог

Mac proof of concept работает с реальным локальным Codex. Собраны два устанавливаемых debug APK. Полная аппаратная приёмка RV101 **не выполнена**: `adb devices -l` вернул пустой список. После сообщения пользователя «подключил» повторная проверка ADB и IOUSB снова не обнаружила интерфейс очков (только USB-хабы). Не утверждаем, что реальный микрофон, HUD, touch/DPAD и TTS уже проверены на очках.

| Проверка | Результат |
|---|---|
| `npm test` | **11/11 PASS** |
| Gateway HTTPS → mock Codex WebSocket | PASS: создание, две реплики одного thread, progress/final, stop |
| Auth / routing | PASS: неверный token 401; device не имеет admin route; произвольный cwd отклонён; alias/symlink проверяются |
| Approvals | PASS: ожидание без auto-accept, timeout decline, отдельный local accept, повторный approval отклонён, permissions expansion denied |
| Retry / reconnect | PASS: дубликат requestId не создаёт turn; иной body с тем же id — conflict; неизвестный исход блокирует повтор; reconnect возобновляет активный turn и сбрасывает старый approval |
| MCP safety | PASS: при доступном MCP session не принимается; реальный Codex показал disabled/0 tools для всех трёх унаследованных серверов |
| Реальный `codex app-server` | PASS, codex-cli 0.157.1; локальная ChatGPT авторизация; two-turn README → TODO; полный restart между репликами |
| Реальный daemon из `.local/config.json` | PASS: `gateway_ready`, health `{protocol:1,codex:true,loggedIn:true,stt:true}` |
| Адреса слушателей (`lsof`) | PASS: Codex `127.0.0.1:8390`; admin `127.0.0.1:8791`; первоначальный HTTPS loopback, затем LAN `192.168.1.66:8443` |
| Русский synthetic audio → Whisper | PASS на CPU; смысл распознан, слово README неточно |
| Реальный HTTPS `/v1/stt` → Whisper | PASS на том же synthetic WAV |
| `testDirectDebugUnitTest` | PASS, 2 теста |
| `testNexusDebugUnitTest` | PASS, 2 теста |
| `assembleDirectDebug`, `assembleNexusDebug` | PASS; APK + SHA256SUMS в dist/ |
| `lintDirectDebug`, `lintNexusDebug` | PASS, **0 errors, 5 warnings** в каждом варианте |
| launchd plist | `plutil -lint`: OK; launchd job не установлен |
| npm audit после фиксации ws 8.22.0 | 0 vulnerabilities на момент установки |
| Реальные RV101 / Nexus hubs / ADB provisioning / TTS | **НЕ ПРОВЕРЕНО: устройство не подключено** |

## Реальное доказательство сохранения контекста

Последний smoke thread: `01a0f71a-a23e-7d01-9f64-067e44cafcda`.

Первый запрос:

> Посмотри README текущего проекта и скажи, что это за проект. Назови его точное название.

Ответ:

> Точное название проекта — ROKID_44ec4647. Согласно README, это интерактивный голосовой терминал Rokid для локального Codex на Mac.

После этого gateway и app-server полностью остановлены и запущены заново, загружен state.json, выполнен thread/resume.

Второй запрос:

> А теперь найди основные TODO. Назови также проект из нашего предыдущего сообщения, не перечитывая README.

Ответ:

> Проект — ROKID_44ec4647. README повторно не читал. В work.txt два TODO: проверить микрофон очков; проверить повторное подключение.

Smoke проверяет случайный marker в обоих ответах, фактическое TODO, одинаковый threadId, завершённые turn и history с двумя turn. Временный fixture удалён; тестовые thread остаются в истории Codex. Production-проект автоматически этим тестом не изменялся.

## Реальное STT

Синтетическая фраза macOS Milena:

> Посмотри файл README текущего проекта и найди основные задачи.

Whisper base multilingual 1.9.4 вернул:

> Посмотри файл реаднтикущего проекта и найди основные задачи.

Это подтверждает работоспособность русской транскрипции и HTTP audio path, но показывает ограничение точности технических названий. Это не запись с микрофона RV101. Исходный Metal запуск не прошёл в sandbox, поэтому рабочая конфигурация использует CPU (`-ng`). Ошибки процесса Whisper преобразуются в фиксированный код `stt_failed`, без stderr/audio в ответе или логах gateway.

## Сборка

Последняя команда: Gradle test/assemble/lint для directDebug и nexusDebug.

```text
BUILD SUCCESSFUL in 4s
95 actionable tasks: 50 executed, 45 up-to-date
```

Lint warnings: собственный trust manager для строгого out-of-band certificate pinning и hardcoded UI strings. Проверка сертификата не отключена: сверяются SHA-256 leaf и срок действия, redirects запрещены, HTTPS обязателен. Пока не выполнены instrumented tests TLS pinning на Android и физическая проверка APK. Android backup/device transfer явно запрещены для приватного содержимого.

## Известные ограничения

1. iPhone не может заменить Nexus Android phone hub. Основной direct flavor работает по Wi-Fi с Mac и не использует iPhone.
2. Реальный RV101 не подключён. Sideload, разрешение микрофона, аппаратные жесты, HUD и наличие русского Android TTS остаются acceptance gates. Нет доказанного hardware end-to-end.
3. Direct input: tap-to-start / tap-to-send, максимум 30 секунд; VAD/wake word и always-listening отсутствуют. STT base может ошибаться; аудио не сохраняется для истории.
4. TTS в direct flavor зависит от движка/языка на устройстве; в Nexus — от настройки хабов. При отсутствии TTS остаётся текст.
5. Read-only by default. Записи/опасные команды требуют отдельного решения на Mac; разрешение может выходить из sandbox. Allowlist — контроль cwd, не полная изоляция чтения файлов. Не multi-tenant система.
6. Локальный import idle Codex thread поддержан через admin CLI; UI выбора произвольного Desktop thread на очках пока нет. Не допускается параллельное управление одним thread несколькими клиентами.
7. Неопределённый исход turn/start не повторяется автоматически. При неизвестном turnId нужно проверить thread на Mac; reconcile либо новый диалог после проверки. Сессия без единого turn может не иметь persisted rollout для resume после перезапуска.
8. Snapshot polling раз в секунду вместо WSS до очков; Codex streaming приходит gateway через WebSocket. Ответ ограничен 16k символами, TTS — 600. Нет media/camera/meeting recording.
9. Ручная привязка certificate pin/device token; один владелец, нет QR-pairing/revocation UI и отдельных токенов на каждое устройство. Remote/Tailscale/Cloudflare отложены.
10. До 100 сессий / 10 000 mutation request IDs; при достижении лимита возвращается ошибка вместо удаления дедупликации. Нет UI архива/очистки.
11. В рабочей config включён bind HTTPS на LAN IP Mac 192.168.1.66; при смене сети обновить его. Первый loopback daemon остановлен; после сообщения о подключении очков gateway запущен на 192.168.1.66:8443 и оставлен работающим для установки. Автозапуск не установлен.
12. APK debug-signed; release signing/update workflow не настроен. TLS pin и секреты не встроены в бинарники. ADB provisioning работает только с debug run-as и пока не проверен на физическом RV101.
13. Codex protocol экспериментальный, проверен на 0.157.1. В этой версии schema ещё перечисляет untrusted, но runtime отклоняет его; используется on-request. При обновлении Codex повторить smoke и isolation checks.

## Локальные зависимости, добавленные для проверки

Homebrew: openjdk@21, whisper.cpp, android-commandlinetools и необходимые транзитивные зависимости (часть существующих Homebrew зависимостей обновлена). Android SDK platform 36/build-tools 35.0.0/platform-tools; Gradle 8.11.1 и Maven-зависимости в обычных пользовательских caches. Модель ggml-base.bin скачана в ignored `.local/models`. Файлы shell startup и системный Java symlink не менялись. Пример launchd подготовлен, но не активирован.
