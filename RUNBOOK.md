# Запуск RV101 → Codex на macOS

## Основной AIUI путь и альтернативные APK

Основной клиент — **AIUI через Hi Rokid на iPhone**, без ADB; установка и приёмка описаны в [AIUI_SETUP.md](AIUI_SETUP.md). Здесь описаны общий Mac gateway/STT и дополнительные APK. Каноническая архитектура — [ARCHITECTURE.md](ARCHITECTURE.md), актуальные границы проверки — [setup status](docs/setup-status.md).

Direct APK устанавливается на RV101 и сам отправляет аудио на Mac. Nexus APK нужен только при наличии Android-телефона с Nexus phone hub и спаренных очков с Nexus glasses hub.

Сборки:

- `dist/rokid-mac-direct-debug.apk` — установить на RV101.
- `dist/rokid-mac-nexus-debug.apk` — установить на Android-телефон, если используется Nexus.

Это debug-сборки для MVP, не подписанные release-ключом. ADB provisioning использует `run-as`, доступный для debug APK. Физическая проверка именно APK ещё необходима; [TEST_RESULTS.md](TEST_RESULTS.md) хранит исторические результаты первой итерации.

## 1. Mac

Нужны Node 22+, установленный локальный `codex`, рабочая авторизация пользователя:

```sh
cd /Users/hermes/Projects/Rikid-agent
codex --version
codex login status
npm ci
npm run setup
```

`setup` запускается один раз. В этой рабочей копии он уже выполнен. Повторный запуск откажется перезаписывать настройки и токены. Он создаёт `.local/config.json`, два различных случайных токена, self-signed TLS сертификат, приватный ключ и SHA-256 fingerprint. Каталог `.local` имеет права 0700, ключи/токены — 0600 и исключены из Git. Не публикуйте его содержимое.

В `.local/config.json` укажите настоящие абсолютные пути проектов:

```json
{
  "host": "0.0.0.0",
  "port": 8443,
  "adminPort": 8791,
  "codexPort": 8390,
  "codexBinary": "/opt/homebrew/bin/codex",
  "projects": { "rikid": "/Users/hermes/Projects/Rikid-agent" },
  "defaultProject": "rikid"
}
```

Это **фрагмент** — сохраните остальные поля tokenFile/adminTokenFile/certFile/keyFile/stateFile/stt. Setup по умолчанию использует `host: 127.0.0.1`. Во время первой проверки был настроен LAN адрес Mac; текущий адрес проверяйте в приватной конфигурации, не выводя её секретные поля. На другом Mac для очков замените на конкретный LAN IPv4 адрес Mac (предпочтительно) или `0.0.0.0`. Только HTTPS gateway будет доступен в LAN; app-server всегда жёстко привязан к 127.0.0.1. Admin HTTP тоже только 127.0.0.1. Не перенаправляйте порты роутера.

Проекты адресуются короткими aliases `[a-z0-9_-]`. Ни путь, ни произвольные параметры Codex клиент передавать не может. Путь canonicalized через realpath; подмена root симлинком отклоняется. Allowlist определяет cwd, а не отдельный контейнер для чтения файлов.

```sh
npm start
```

Успех: `gateway_ready`. Остановка: Ctrl-C. Перед повторным запуском проверьте занятость портов через lsof; не используйте PID из старого отчёта и не останавливайте работающий gateway без необходимости. Никаких токенов, prompt, raw RPC или stderr Codex в логах daemon нет. Если заняты 8390/8791/8443, выберите свободные порты в config. Gateway не присоединяется молча к чужому app-server.

Проверка gateway в другом терминале (helper использует host из config; при 0.0.0.0 подключается к loopback):

```sh
node scripts/client.mjs health
node scripts/client.mjs projects
node scripts/client.mjs new rikid
node scripts/client.mjs ask SESSION_ID 'Посмотри README текущего проекта и скажи, что это за проект.'
node scripts/client.mjs watch SESSION_ID
node scripts/client.mjs ask SESSION_ID 'А теперь найди основные TODO.'
node scripts/client.mjs watch SESSION_ID
```

SESSION_ID — поле `id` из `new`, не `threadId`. В двух ответах `threadId` должен совпадать. Helper читает token из файла, не передаёт секрет в argv. `health` проверяет initialize/account-read; только завершённый smoke-turn доказывает работоспособность inference.

## 2. Локальное STT для AIUI и прямого RV101 APK

Установлены через Homebrew `openjdk@21`, `android-commandlinetools`, `whisper.cpp` и их зависимости. SDK platform 36, build-tools 35.0.0 и platform-tools также установлены. Пути этой машины:

```text
JDK: /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
SDK: /opt/homebrew/share/android-commandlinetools
Whisper: /opt/homebrew/bin/whisper-cli
Model: /Users/hermes/Projects/Rikid-agent/.local/models/ggml-base.bin
```

На другом Mac:

```sh
brew install openjdk@21 android-commandlinetools whisper-cpp
mkdir -p .local/models
curl -fL https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin -o .local/models/ggml-base.bin
```

Модель multilingual base (~148 MB), не `.en`. Это отдельный локальный runtime, не платный STT API и не часть ChatGPT OAuth. Конфигурация уже добавлена на этой машине:

```json
"stt": {
  "binary": "/opt/homebrew/bin/whisper-cli",
  "model": "/Users/hermes/Projects/Rikid-agent/.local/models/ggml-base.bin",
  "language": "ru"
}
```

По умолчанию CPU (`-ng`), потому что Metal-инициализация не прошла в ограниченном окружении проверки. `"gpu": true` можно включить после отдельной проверки. Аудио — mono PCM16 16 kHz WAV до 30 секунд, один STT job одновременно, таймаут 90 секунд. Временные WAV/результат удаляются в finally; при аварийном завершении процесса проверьте оставшиеся `rokid-stt-*` в системном TMPDIR и удалите только эти каталоги после остановки gateway. Запись встреч не реализована.

Воспроизводимая проверка на синтетической речи macOS:

```sh
say -v Milena -o .local/stt-smoke.aiff 'Посмотри файл README текущего проекта и найди основные задачи.'
ffmpeg -y -loglevel error -i .local/stt-smoke.aiff -ar 16000 -ac 1 -f s16le .local/stt-smoke.pcm
node scripts/stt-smoke.mjs
```

Это проверяет Whisper, не микрофон очков. На шумной речи и технических названиях base может ошибаться; можно отдельно настроить larger multilingual model, не меняя протокол.

## 3. Сборка APK

```sh
cd android-plugin
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
./gradlew :app:testDirectDebugUnitTest :app:assembleDirectDebug :app:testNexusDebugUnitTest :app:assembleNexusDebug
```

Исходные outputs находятся в `app/build/outputs/apk/direct/debug/` и `app/build/outputs/apk/nexus/debug/`. Готовые копии первой итерации — в `dist/`, SHA256SUMS рядом. Проект не содержит private SDK/cache; local.properties не нужен при ANDROID_HOME.

## 4. Fallback direct APK: установка через ADB

На RV101 включите developer mode / USB debugging через доступный интерфейс Rokid. Подключите к Mac **кабелем с передачей данных**, разрешите отладку. Reference rokid-personal-ai указывает разработческий 5-pin кабель; штатный зарядный 3-pin может не передавать данные. Убедитесь, что Mac и RV101 в одной LAN и очки могут достучаться до Mac (guest Wi-Fi/client isolation может мешать).

```sh
export PATH="/opt/homebrew/share/android-commandlinetools/platform-tools:$PATH"
adb devices -l
adb install -r dist/rokid-mac-direct-debug.apk
node scripts/pair-direct.mjs https://MAC_LAN_IP:8443
adb shell am start -n local.rokid.codex/.VoiceActivity
```

Если устройств несколько: `adb -s SERIAL ...`, provisioning: `node scripts/pair-direct.mjs https://MAC_LAN_IP:8443 SERIAL`.

Provisioning передаёт JSON **по stdin** ADB, записывает его через `run-as` в приватный files/provision.json, открывает SettingsActivity. Приложение проверяет поля, шифрует токен Android Keystore AES-GCM и удаляет временный JSON. Токен отсутствует в APK и аргументах shell. Не используйте `adb shell input text TOKEN`, публичный Download-каталог или URL с токеном. Если импорт не произошёл, удалите оставшийся приватный provision.json через run-as и повторите настройку.

Вручную можно открыть SettingsActivity, ввести HTTPS адрес, fingerprint из `.local/certificate-sha256` и device token из `.local/device-token`. Экран защищён FLAG_SECURE, backup отключён. **admin-token никогда не переносится на устройство.** Обновляйте APK с тем же debug signer для сохранения данных.

UX:

1. Откройте Mac Codex в launcher RV101. Приложение восстановит сохранённую сессию.
2. Нажатие / Enter / центр DPAD → Listening. При первом запуске разрешите микрофон.
3. Произнесите запрос. Ещё одно нажатие отправляет запись; максимум 30 секунд.
4. Thinking: распознавание на Mac, затем распознанная команда. Working: Codex выполняет задачу.
5. Done: текст на HUD; поддерживаемый системный Android TTS произнесёт короткий ответ. Если TTS отсутствует или не поддерживает русский, текст остаётся доступен.
6. Swipe/DPAD листает ответ, следующая реплика продолжает тот же thread. Menu или кнопка Настройки открывает настройки. Back закрывает приложение, останавливает микрофон/TTS, но не удаляет диалог и не отменяет уже отправленную задачу.

Команды: «стоп», «новый диалог», «выбери проект rikid», «краткий итог», «продолжай». Во время активной работы принимается только stop; steering не реализован. Выбор проекта создаёт новую сессию. После ошибочного alias или неизвестного исхода запроса проверьте Mac, затем при необходимости отвяжите локальную сессию в настройках. Сброс привязки не отменяет задачу на Mac.

## 5. Дополнительный Nexus-вариант

Установите nexus APK на Android-телефон. Nexus phone/glasses hubs должны быть настроены и связаны. В Plugin access одобрите surfaces/STT/TTS, в speech settings настройте работающий STT provider. Plugin settings задаёт тот же HTTPS адрес, pin и device token. Плагин использует SDK speech final, а не WAV upload; Whisper на Mac ему не требуется. Запуск через launcher очков; tap начинает речь, final STT отправляет текст ровно один раз, HUD показывает статусы, SDK TTS озвучивает ответ. Capabilities camera/microphone не запрашиваются: raw PCM не нужен при hub STT.

## 6. Approvals и безопасность

Daemon выбирает native `workspace-write`, `approvalPolicy: on-request`, `approvalsReviewer: auto_review`. Допустимые операции и escalation рассматривает Codex; gateway не отвечает accept самостоятельно. Настоящие human requests сразу видны как pending и ждут решения/native resolution/cancel/disconnect. Автоматического 120-секундного отказа нет; явно заданный approvalTimeoutMs остаётся опциональным:

```sh
npm run ctl -- approvals
npm run ctl -- decline APPROVAL_UUID
# Только после проверки полного command/params на Mac:
npm run ctl -- accept APPROVAL_UUID
```

Прочитайте точную команду и пути, а не только reason от модели. Accept разрешает **одно** действие, которое может выйти из sandbox; это не обещание защиты за пределами approved action. Для опасного действия отдельное решение необходимо. Device API не содержит маршрута approval; даже device token не работает на admin API. Не подменяйте выбранный Approve for me режимом danger-full-access или approval_policy=never.

Allowlist ограничивает выбор рабочего проекта, но Codex может читать и другие доступные локальные файлы. Этот MVP предназначен одному владельцу, не для недоверенных пользователей и не для multi-tenant isolation. MCP/apps/plugins/skills наследуются из effective Codex config; user-disabled capabilities остаются выключенными. Native hook trust сохраняется, но side effects доверенных startup/hooks не ограничиваются tool approvals. App/MCP/plugin approval modes и reviewers наследуются без clamps; native default shell network остаётся ограниченным, host/browser/tool network рассматривается отдельно. Credentials не копируются; child environment сохраняет прежний allowlist (env-only credentials вне него недоступны).

Gateway не пишет prompts/ответы в stdout, но последние ограниченные ответы и request fingerprints сохраняются в приватном state.json, а история сохраняется самим Codex. Android сохраняет pending prompt в приватных preferences до подтверждения доставки, чтобы не повторить turn. Аудио не сохраняется как архив.

## 7. Resume, stop и диагностика

```sh
npm run ctl -- sessions
npm run ctl -- import rikid EXISTING_CODEX_THREAD_ID
npm run ctl -- reconcile
node scripts/client.mjs stop SESSION_ID
```

Import доступен только локально, проверяет реальный cwd thread и отклоняет active thread. Не управляйте одним thread одновременно из Desktop и очков. Поле id импортированной сессии используйте с API; UI выбора произвольного Desktop thread на очках пока отсутствует.

При обрыве сеть восстанавливается с backoff до 10 секунд. У повторно отправленного POST остаётся прежний requestId. Если неизвестно, дошёл ли turn/start, gateway **не повторяет prompt**; показывает `turn_delivery_uncertain` / `recovery_requires_local_review`. Сверьте thread на Mac, выполните reconcile. Если удалось восстановить конкретный turn, status обновится. Если его id так и неизвестен, используйте новый диалог после проверки исходного thread. Не удаляйте state.json для устранения обычного сетевого сбоя.

Health `codex:false` → проверьте daemon/app-server; `loggedIn:false` → локальный codex login. STT `stt_not_configured` → пути binary/model; `stt_failed` → локально проверьте whisper-cli с тестовым WAV. TLS error → проверьте дату очков и точный fingerprint; не отключайте проверку TLS. После замены сертификата перепривяжите устройство. Для отзыва доступа смените только device-token на новый случайный 32-byte token, chmod 600, перезапустите gateway.

## 8. Необязательный запуск при входе в macOS

```sh
node scripts/launchd.mjs
mkdir -p ~/Library/LaunchAgents
cp .local/local.rokid.codex.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/local.rokid.codex.plist
```

Foreground daemon сначала остановить. Plist содержит абсолютные пути и не содержит токенов. `RunAtLoad`/`KeepAlive` — только пример; автоматическая установка launchd в этой итерации не выполнялась.

```sh
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/local.rokid.codex.plist
```

## 9. Тесты и аппаратная приёмка

```sh
npm test
npm run smoke
```

Smoke использует реальный аккаунт Codex, временный fixture-проект и две реплики в одном thread. Между репликами перезапускаются gateway и app-server. Финальный текст первой реплики содержит случайное название README; вторая должна вспомнить его и найти TODO. Временный проект удаляется; тестовый thread остаётся в локальной истории Codex.

На RV101 отдельно проверить: реальный микрофон, кнопки/DPAD, размер HUD, TTS, две реплики README→TODO в одном thread, Wi-Fi reconnect после потери ответа POST, возврат после закрытия APK, остановку turn и отсутствие разрешения опасной операции без Mac approval. Эти пункты не заменяются синтетическим аудио или mock-тестом.


## Codex tool parity (ALE-453)

Без provider SDK/OAuth клиентов: используются существующие native connections пользователя.
Inventory — отдельный временный app-server, не production и не доказательство physical acceptance:

```sh
node scripts/tool-parity-inventory.mjs
node scripts/tool-parity-smoke.mjs
node scripts/tool-parity-dynamic-smoke.mjs
```

Первый script выводит только санитизированные capability metadata. Второй проверяет native auto-review на MCP со счётчиком в памяти: разрешённая reviewer операция меняет его один раз без gateway-generated accept; provider drafts/письма не создаются. Третий отключает/включает существующий
node_repl MCP только в временном project config с новым процессом на каждом шаге, не редактируя user config.
Scripts запускают локальные порты и используют текущий Codex account для model smoke; это не offline unit tests.

Production evidence (локально на Mac):

```sh
npm run ctl -- tool-events
npm run ctl -- runtime
npm run ctl -- approvals
npm run ctl -- accept APPROVAL_ID
npm run ctl -- decline APPROVAL_ID
```

`accept` выполняется только после отдельного решения владельца, не на основании голосового prompt.
Для MCP поддерживается пустая native confirmation form с `_meta.codex_approval_kind=mcp_tool_call`;
URL/OAuth/device-proof/free-text формы отклоняются, а не заполняются автоматически. Pending виден на
существующем HUD. Просматривайте параметры только локально; не копируйте approval details в логи/Linear.
Tool events содержат только bounded identifiers/status, не пользовательские данные. Не вызывайте
`mcpServer/tool/call` напрямую для write acceptance: это диагностический API, не нормальный model turn.

После изменения normal Codex config перезапустите gateway в idle состоянии, сохранив `.local/state.json`.
Endpoint/token/private AIX менять не требуется. Проверяйте прежние session/thread IDs и реальный tool event,
а не только текст ответа модели. Не все Desktop host callbacks доступны standalone app-server; точные
ограничения и результаты — [validation](specs/004-ale-453-tool-parity/validation.md).

Для MCP применяется normal native policy, без Jarvis blanket prompt. Существующие Computer Use app-level grants могут требовать человека даже при auto_review. Не выдавайте новые app permissions или auth proofs автоматически. Смотрите фактические review events и surface evidence.
