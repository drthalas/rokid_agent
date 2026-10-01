# Mac Codex на RV101 через AIUI Studio / Craft — без ADB

Руководство опирается на документацию и cloud-проверку 1 октября 2026 года. Актуальный зафиксированный статус версий/проверок — [setup status](docs/setup-status.md); архитектура — [ARCHITECTURE.md](ARCHITECTURE.md). В ходе architecture bootstrap облако и очки повторно не проверялись.

## Что создано

- `aiui-agent/` — самостоятельный AIUI проект: AGENTS.md, app.json, app.js, Ink-страница и JS-модули.
- `dist/mac-codex-aiui.aix` — пакет, собранный официальной `@yodaos-pkg/aix-cli` 0.10.1; **без адреса и секретов**. Подходит для импорта/проверки структуры, но до настройки соединения показывает Error.
- `dist/mac-codex-aiui.aix.sha256` — контрольная сумма.
- `dist/mac-codex-aiui-private.aix` — созданная локально приватная configured build для текущего Quick Tunnel; содержит device token, права 0600, исключена из Git. Текущий URL хранится только в `.local/quick-tunnel-url`.
- `aiui-agent/tools/configure.mjs` — создаёт отдельный приватный проект с выбранным HTTPS адресом и device token.

Существующие `src/` gateway/Codex, конфигурация gateway, Android APK и протокол не изменены этой задачей.

```text
«Hi Rokid, Mac Codex»
    → зарегистрированный AIUI Agent → Ink Page на RV101
    → короткая PCM запись → WAV → HTTPS /v1/stt на Mac → transcript
    → /v1/sessions/:id/turns → существующий gateway → тот же Codex thread
    → polling snapshot → HUD Listening / Working / Done / Error
    → автоматический короткий TTS через штатный Rokid SpeechAudioPlayer, если доступен
```

Invocation только открывает READY и не отправляет `prompt` как задачу. После открытия нажмите на дужку, произнесите задачу и нажмите повторно для отправки.

## 1. Что переиспользовано из rokid-personal-ai

Reference закреплён на `23f98ff2946f7575997383929b87867503eab607`.

| Компонент | Решение |
|---|---|
| `voice-aix-source/lib/one-shot-audio.mjs` | Переиспользован без изменения логики как `aiui-agent/lib/one-shot-audio.js`, с исходным MIT notice. Используем параметры 30 секунд / 960000 PCM bytes; VAD определяет наличие речи; в текущей странице `automaticStopOnSilence: false`, запись завершается тапом или лимитом 30 секунд. |
| `voice-aix-source/pages/index/index.ink` | Использованы структура Ink, lifecycle recorder callbacks и принцип управления жестами. Наша страница существенно меньше: только голосовой терминал, без эффектов и заметок. |
| `prepare-voice-aix.mjs` | Референс состава AIX, а не скопированный zip pipeline. Упаковка через официальную AIX CLI с VERSION и manifest. |
| Relay / Cloudflare / Obsidian / effect proposals / отдельный Codex session | Не нужны: используется уже работающий gateway. |
| Private AIUI production code / device scene closer автора | Не опубликованы; мы на них не полагаемся. Back/close обрабатывает стандартный host lifecycle. |

Лицензия MIT сохранена в `aiui-agent/licenses/`. Официальные AIUI API дополнительно сверены с `yodaos-project/AIUI` commit `b1e9ff620b41b306bd50ef87d401f32d6c57edb5`; skill `aiui-dev` использован как руководство авторинга, но не включён в пакет.

## 2. Нужный account и устройства

Нужен **Rokid account**, которым вы вошли в Hi Rokid на iPhone и к которому привязаны RV101. В Studio и Craft используйте тот же аккаунт и тот же регион. Авторизация ChatGPT/Codex на Mac остаётся отдельной и в Rokid не переносится.

Для Global:

- [AIUI Studio Global](https://aiui-global.rokid.com/)
- [Craft Global](https://js.rokid.com/craft?region=global)

Для China используется [AIUI Studio China](https://aiui.rokid.com/). Не переключайте регион наугад: список агентов и доступные сервисы могут различаться. Если ваш account ещё не имеет доступа к developer workspace, завершите предложенную Rokid регистрацию/проверку. Необходимость дополнительных форм определяется текущим интерфейсом аккаунта.

RV101 должны быть связаны с iPhone и доступны в Hi Rokid. Для resource update нужны сеть и работающее соединение приложения с очками. Для запросов к Mac очкам дополнительно нужен сетевой маршрут до gateway. Успешная загрузка AIX с iPhone сама по себе не доказывает, что runtime очков видит LAN Mac.

Официальные основания: [Global QuickStart](https://js.rokid.com/AIUI/guide/quickstart/quickstart?lang=en-US&version=latest), [AIUI Editor](https://github.com/yodaos-project/AIUI/blob/b1e9ff620b41b306bd50ef87d401f32d6c57edb5/documentation/7-tools/editor.en-US.md).

## 3. Сначала обеспечить доверенный HTTPS до Mac

**Текущий `https://192.168.1.66:8443` использует self-signed сертификат.** Android APK проверяет его собственным pinning-кодом. В документированном AIUI `wx.request` нет параметра certificate pin/custom CA; мы не добавляем выдуманный `sslVerify:false` и не отключаем TLS-проверку.

Поэтому для рабочего AIUI frontend нужен HTTPS endpoint с доверенной цепочкой и именем, совпадающим с сертификатом. Два варианта, оба без изменения Codex layer:

1. **Сохранить LAN:** собственное DNS-имя, например `codex.example.net`, разрешается для очков в LAN IP Mac. Получить сертификат для этого имени у доверенного CA (DNS validation позволяет не открывать Mac в интернет). В существующем `.local/config.json` указать `certFile` на полный certificate chain и `keyFile` на соответствующий приватный ключ, права 0600. Сохранить host/port/allowlist и перезапустить gateway. Origin для AIUI: `https://codex.example.net:8443`.
2. **HTTPS reverse proxy/tunnel:** для текущего физического smoke создан Cloudflare Quick Tunnel (раздел 3A). По явному разрешению пользователя проверка self-signed origin certificate отключена только между cloudflared и gateway на этом же Mac. Проверка TLS на AIUI и публичном endpoint не отключается. Порт admin не проксируется; `/admin/*` на device listener возвращает 404. Для постоянного режима предпочтительна проверка upstream certificate.

Для текущего Quick Tunnel собственный домен/сертификат не нужен: доверенный публичный HTTPS предоставляет Cloudflare. Это временный тестовый адрес, который меняется при пересоздании туннеля. Простая замена IP на произвольное имя без такого TLS endpoint доверие к сертификату не создаёт.

Замена gateway certificate изменит fingerprint для прежних APK: их нужно перепривязать. Если оставляете старый сертификат через отдельный TLS front, старые APK менять не нужно. Сам `codex app-server` должен по-прежнему слушать исключительно `127.0.0.1:8390`.

API использует HTTPS + `Authorization: Bearer <device token>`. Не размещайте token в URL. Не меняйте существующий gateway origin/approval policy ради браузерного preview: Craft Web preview может блокироваться CORS, LAN-доступом браузера или ответом `browser_origin_forbidden`. Это отдельная проблема preview; проверка native wx.request проводится на очках.

## 3A. Физический smoke через Cloudflare Quick Tunnel

`cloudflared` 2026.9.3 установлен через Homebrew. Если на другом Mac его ещё нет:

```sh
brew install cloudflared
cloudflared --version
```

Сначала должен работать существующий gateway: `npm start` из корня проекта. Во время этой подготовки он был остановлен и запущен заново с прежней конфигурацией. Исходники src/, allowlist и Codex/thread logic не менялись.

Точная команда текущего туннеля:

```sh
/opt/homebrew/bin/cloudflared tunnel --url https://192.168.1.66:8443 --no-tls-verify --no-autoupdate --protocol http2 --metrics 127.0.0.1:20241
```

**Туннель уже запущен для теста — не запускайте второй экземпляр без необходимости.** Его текущий URL прочитать так:

```sh
cat .local/quick-tunnel-url
```

При самостоятельном запуске URL вида `https://…trycloudflare.com` появится в stdout/stderr cloudflared. Сохраните именно origin без `/v1/health` в `.local/quick-tunnel-url` и поле `origin` файла `.local/aiui.local.json`. Не помещайте его в отслеживаемый config.js. Quick Tunnel не требует Cloudflare account или домена; после остановки процессa адрес перестаёт работать, новый запуск выдаёт другой адрес. См. [официальную документацию Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

`--no-tls-verify` относится **только к origin, заданному --url**. Origin здесь — HTTPS listener этого же Mac. Публичный TLS Cloudflare и стандартная проверка TLS в AIUI остаются включены. Документированное действие флага: [Cloudflare troubleshooting](https://developers.cloudflare.com/tunnel/troubleshooting/). Нет port forwarding роутера и нет публичного listener для app-server. Metrics слушает только loopback.

Не включайте cloudflared debug logging: на этом уровне могут логироваться HTTP headers с Authorization. У запущенного процесса используется info; логи находятся в приватном `.local/quick-tunnel.log` и не содержат device token.

Повторная проверка с Mac, без токена в argv или выводе:

```sh
node aiui-agent/tools/check-tunnel.mjs
```

Проверено: GET `/v1/health` без токена → 401; с неправильным токеном → 401; с device token → 200 и `codex:true, loggedIn:true, stt:true`; `/admin/approvals` с device token → 404. Проверяющий HTTPS клиент использует обычную CA/hostname verification. Отчёт: `.local/quick-tunnel-check.json`.

Application authentication уже была в gateway: случайный 32-byte bearer token, созданный локально `randomBytes(32)`, файл `.local/device-token` с правами 0600, constant-time сравнение. Она переиспользована без изменения бизнес-логики. Токен не передавался в shell args и не выводился; админ-токен не включён в AIX.

После изменения адреса туннеля обновите только приватный `.local/aiui.local.json`, затем:

```sh
npm --prefix aiui-agent run configure -- /Users/hermes/Projects/Rikid-agent/.local/aiui.local.json --private-package
npm --prefix aiui-agent run pack -- --private-package
```

Output: `dist/mac-codex-aiui-private.aix`. Права 0600 устанавливаются с private umask уже при упаковке. Приватный AIX и его checksum исключены через .gitignore. После смены Quick Tunnel URL обязательно заново Upload в Studio и Update glasses resources на iPhone. Стабильный sessionId можно указать в приватной конфигурации, если нужно продолжить тот же gateway session после смены origin (ключ storage клиента включает origin).

### Rollback после теста

1. Закрыть AIUI Agent на очках; при необходимости остановить активный Codex turn через существующий local control. Остановка туннеля сама по себе не отменяет запущенный turn.
2. Для foreground cloudflared — Ctrl-C. Для процесса, запущенного этой подготовкой, сперва сверить PID и executable, затем остановить именно его:

```sh
ps -p "$(cat .local/quick-tunnel.pid)" -o pid=,command=
kill -TERM "$(cat .local/quick-tunnel.pid)"
```

3. Публичный URL перестанет работать. Mac gateway может продолжать работать в LAN, Codex остаётся loopback. Для остановки gateway, запущенного этой подготовкой, аналогично сверить `.local/gateway-smoke.pid` и завершить его; это не требуется для закрытия туннеля.
4. В Studio удалить/отключить приватную тестовую версию либо загрузить безопасный `dist/mac-codex-aiui.aix` без секрета, Save, затем повторить resource update в Hi Rokid.
5. Для полного отзыва загруженного токена сгенерировать новый device-token локально и перезапустить gateway; это также отзовёт остальные клиенты с прежним общим device token. Не менять admin-token и не удалять state.json: история/threads должны сохраниться.
6. Удалить локальные приватные artifacts: `dist/mac-codex-aiui-private.aix`, его `.sha256`, `.local/aiui-private/`, `.local/aiui.local.json`. Не удалять исходный aiui-agent/ и состояние Codex.

Для следующего smoke создать новый tunnel, обновить private build и повторить Upload/resource update. Автозапуск cloudflared и настройки роутера не менялись.

## 4. Подготовить личный AIUI проект

Git checkout содержит безопасный `config.example.js`, но локальный ignored `config.js` может уже быть приватно настроен. Не перезаписывайте его. Следующие команды шаблонной упаковки выполняются только в свежем или изолированном checkout с пустым config:

```sh
cd /Users/hermes/Projects/Rikid-agent/aiui-agent
npm ci
# Только в свежем/изолированном checkout, если config.js отсутствует:
cp -n config.example.js config.js
npm test
npm run check
npm run pack
```

Для приватной рабочей версии скопируйте `connection.example.json` в `/Users/hermes/Projects/Rikid-agent/.local/aiui.local.json` и заполните:

```json
{
  "origin": "https://codex.YOUR_DOMAIN:8443",
  "tokenFile": "/Users/hermes/Projects/Rikid-agent/.local/device-token",
  "project": "rikid",
  "sessionId": "",
  "tts": true
}
```

`YOUR_DOMAIN` заменить реальным именем из сертификата. `project` — существующий alias, не путь к папке. Пустой sessionId создаст новый gateway session и затем будет продолжать его. Чтобы подключить уже работающий диалог, укажите **gateway session id** из `npm run ctl -- sessions`, не Codex threadId. Если thread существует только в Codex, сначала локально `npm run ctl -- import rikid THREAD_ID`, затем используйте возвращённый id. Не управляйте этим thread одновременно из двух frontends.

```sh
npm run configure -- /Users/hermes/Projects/Rikid-agent/.local/aiui.local.json --private-package
npm run pack -- --private-package
```

Результаты:

- `.local/aiui-private/` — папка для импорта в Craft;
- `dist/mac-codex-aiui-private.aix` — настроенный личный AIX.

**Граница секрета:** флаг `--private-package` намеренно включает device token в `config.js` приватного проекта. AIX не является зашифрованным хранилищем. При Upload этот токен будет доступен Rokid Cloud и пользователям, имеющим доступ к исходникам/пакету. Такой агент нельзя публиковать в общем Store или класть в публичный GitHub. Скрипт не переносит token автоматически из Mac config, требует явный private-флаг, не печатает token и отказывается от известного admin-token. Приватный пакет с device token теперь создан локально по явному запросу пользователя. Приватная cloud-версия уже сохранена в Rokid account; публичная публикация не выполнялась.

Для отзыва доступа смените device-token на Mac и перепакуйте личного агента; текущий gateway использует один общий device token, поэтому это отзовёт и другие клиенты с ним. Account-bound secret provisioning вместо embedded token — отдельное улучшение, не реализованное здесь.

## 5. Создать Agent в AIUI Studio

1. На Mac откройте Studio Global и войдите в тот же Rokid account, что в Hi Rokid.
2. Если интерфейс показывает **Application Management → Create Application**, выберите тип **AIUI Agent**. Имя: **Mac Codex**. Если вместо этого текущая Studio предлагает **Local import / Create with Coding / Import from GitHub**, выберите **Local import** и нужную папку проекта. Выбирайте один путь, не создавайте дубликаты.
3. Описание: «Голосовой терминал для моего Codex на Mac. Продолжает диалог в локальном проекте и показывает результат на очках».
Если форма требует категорию или иконку, заполните их перед сохранением; для публичного review стандартную иконку нужно заменить своей.

4. Сохраните созданный Agent ID. Если свежий агент пока не имеет файлов и показывает load failure, перейдите к привязке проекта, а не создавайте ещё одного.
5. Семантическое назначение открытия READY без task prompt задано в AGENTS.md и schema страницы. Оставьте узнаваемое имя **Mac Codex**, чтобы его можно было вызвать голосом.

Новая Studio также позволяет сразу импортировать локальный проект и работать без отдельного Craft. Это официальный альтернативный UI того же процесса. Точные подписи и доступность могут зависеть от версии и региона — [официальный обзор Rokid](https://global.rokid.com/es/blogs/academy-glasses/glasses-3-6-aiui).

## 6. Привязать локальный проект в Craft

1. Откройте Craft Global, войдите тем же account.
2. Импортируйте **только** `aiui-agent/` для шаблона или `.local/aiui-private/` для рабочего личного проекта. Можно импортировать соответствующий `.aix`. Не импортируйте корень Rikid-agent: в нём есть Mac tools и `.local` с приватными данными.
3. Убедитесь, что в корне дерева видны AGENTS.md, app.json, app.js, config.js и pages/index/index.ink.
4. Откройте **Settings → Local Management** и привяжите этот проект к **Mac Codex**, созданному в Studio. Сверьте Agent ID из Studio. `develop.rokid.agent.…`, который показывает локальный `aix show`, — локальная производная от VERSION, а не подтверждение привязки к облачному аккаунту.
5. **Run Agent / Interactive Inview** позволяет проверить экран и состояния. При импорте ненастроенного шаблона ожидается сообщение о ненастроенном соединении. Микрофон и native network в браузере не равнозначны RV101.

Этот порядок привязки описан в [официальной документации AIUI Editor, раздел VII](https://github.com/yodaos-project/AIUI/blob/b1e9ff620b41b306bd50ef87d401f32d6c57edb5/documentation/7-tools/editor.en-US.md).

## 7. Pack и Upload

1. В Craft используйте **Pack** для текущей привязанной папки. Если Pack объединён с deployment, следуйте следующему Upload-экрану. Для текущего smoke импортируйте **dist/mac-codex-aiui-private.aix** (не безопасный шаблон) и выберите Upload.
2. Проверьте назначение — ваш **Mac Codex / Agent ID**, правильный account/region.
3. На Upload-экране сохраните согласованные permissions **Network, Camera, Microphone, Speaker**. Camera оставлена по решению владельца; текущий voice runtime её не вызывает. Agent-local storage используется для session/pending state. Location не требуется. В техническом `app.json.permissions` объявлен только поддерживаемый sensitive permission **RECORD_AUDIO**; не добавляйте несуществующие permission-строки NETWORK/TTS/STORAGE.
4. Сохраните описание и данные версии, дождитесь **Upload successful**.
5. В новом интерфейсе AIUI Studio эквивалент — **Build & Review → Package AIX / AIX Packaging**, затем **Save** информации агента. Пакет синхронизируется в cloud, версия увеличивается сервером. Локальный package.json version не заменяет облачную version.
6. Проверьте, что новая версия действительно появилась у нужного Agent ID. Простое сохранение файла в Craft без Pack/Upload не обновляет очки.
7. Не нажимайте публикацию в публичный Store для пакета с личным token. Официальный workflow выделяет real-device debugging до Submit for review; если ваш account требует другой статус, ориентируйтесь на показанную ошибку/доступность, не обходите проверку.

Официальное основание: [Real-device debugging](https://github.com/yodaos-project/AIUI/blob/b1e9ff620b41b306bd50ef87d401f32d6c57edb5/documentation/0-guide/debug/real_device_debug.en-US.md). Локальная CLI здесь только упаковывает AIX; команды `aix install` и `aix launch-page` используют ADB и для этой установки не нужны.

## 8. Загрузить на RV101 через iPhone

1. Откройте **Hi Rokid** на iPhone и убедитесь, что RV101 подключены.
2. Проверьте account: тот же пользователь и регион, что в Studio/Craft.
3. Откройте **Settings → Developer / Developer Options → AIUI → Update glasses resources**. В другой версии приложения последняя команда может называться **Update glasses resource package** и находиться непосредственно в Developer.
4. Дождитесь **Agent resource package downloaded successfully**. Не отключайте очки во время загрузки.
5. Если пакет обновлён, переходите к запуску. ADB-кабель, adb install и Android-телефон для этого пути не требуются.

Сначала Pack/Upload, затем Update glasses resources — не наоборот.

## 9. Новый temple-driven UX (frontend 0.2.0, cloud 1.0.8)

1. Произнесите **“Hi Rokid, Mac Codex”**. Invocation только открывает READY, не отправляется в Codex как prompt.
2. На HUD: **Mac Codex / ● Готов / Нажмите на дужку и говорите**. Сохранённый старый ответ при открытии не показывается.
3. Один тап → LISTENING. Говорите; следующий тап завершает запись. Автоотправка по паузе выключена, верхний лимит — 30 секунд.
4. TRANSCRIBING → THINKING → WORKING → DONE. На экране только текущее состояние; меню кнопок отсутствует.
5. Ответ появляется на HUD и автоматически озвучивается один раз за turn. Для длинного ответа используется короткий фрагмент из первых законченных предложений; полный текст доступен прокруткой. Это extractive preview, а не дополнительная задача Codex.
6. Тап после DONE останавливает озвучку и начинает следующую запись в том же gateway session/thread.
7. Тап во время выполнения отменяет текущий запрос/turn. Этот жест использует документированный Enter/GlobalHook; недокументированный long press не назначен.
8. Двойной тап, который host выдаёт как Backspace, закрывает агент штатным действием host. Запись и отложенная отправка отменяются; сохранённый Codex thread не удаляется. Закрытие экрана само по себе не гарантирует отмену уже выполняемого turn: для этого предусмотрен тап во время выполнения.
9. Свайп используется для прокрутки ответа. GlobalHook down/up и сопутствующий Enter дедуплицируются; отправка записанного звука отложена на 650 ms, чтобы Backspace успел отменить её при двойном тапе.

Ожидаемые реальные коды: Enter, GlobalHook, Backspace, ArrowUp/ArrowDown. В agent-local storage `mac-codex-temple-trace` сохраняются только последние 32 кода/направления события и состояния, без речи/ответов/секретов. Документация и тесты подтверждают обработку этих последовательностей; конкретное поведение firmware RV101 проверяется физическим acceptance test после resource update.

Backend unavailable: **Codex недоступен на Mac** и короткий reason. Отдельных кнопок повтора/озвучки нет; транспорт восстанавливается с прежними session/request IDs. Старые диалоги не удалялись.

## 10. Диагностика загрузки и запуска

| Симптом | Что проверить |
|---|---|
| Agent отсутствует в Local Management | Account и region, сохранение Agent в Studio, обновление списка. Не спутать Studio China и Global. |
| Load failure у нового Agent | Есть ли привязанный исходный проект; app.json entry и существующий Ink route. |
| Pack не проходит | Запустить npm run check и npm run pack; импортировать папку с app.json в корне. Не импортировать monorepo целиком. |
| Upload failed | Точный текст ошибки, Agent ID, разрешения account, обязательные поля описания. Retry только после исправления указанной причины. |
| Update прошло, но старая версия | Был ли новый Pack/Upload/Save именно у этого Agent ID; account Hi Rokid совпадает; resource update дождался успеха. |
| “Agent resource package…” не появляется | Связь iPhone↔RV101, интернет, заряд, видимость очков в Hi Rokid, повтор после восстановления связи. |
| Команда открывает штатный ассистент | Имя агента, семантическое описание/AGENTS.md, нужный язык/регион; подтвердить, что пакет зарегистрирован, а не только локально упакован. |
| Ошибка engine/runtime | Соотнести firmware и AIUI runtime с AIX engine metadata. Не менять range только ради обхода проверки: используемые API должны реально поддерживаться. |
| Error: подключение не настроено | Загружен безопасный шаблон, а не приватная настроенная версия. |
| network_or_tls_error | Доверенная цепочка, hostname/SAN, дата очков, DNS, достижимость LAN Mac, Wi-Fi client isolation, порт. Self-signed cert не поддерживается этим frontend. |
| unauthorized | Нужен device-token от текущего gateway, не admin-token; возможно, token уже ротирован. |
| browser_origin_forbidden в Craft | Это браузерный preview, не native device test. Не отключать security check gateway ради preview. |
| invalid_gateway_session / session_not_found | Нужен gateway id, не Codex threadId; проверьте ctl sessions. Не создавайте новый thread автоматически для маскировки ошибки. |
| Микрофон недоступен | RECORD_AUDIO в app.json и Upload capabilities; разрешение host; поддержка RecorderManager; запуск от tap/voice event, не из фонового timer. |
| Нет Done / требуется approval | Состояние gateway/Codex и `npm run ctl -- approvals`; решение принимается только на Mac. |
| Нет TTS | Старый runtime/недоступный speech service/язык; HUD продолжает работать. |

При неопределённом результате POST сохранённый requestId повторяется, новый prompt не создаётся. Если gateway возвращает request_outcome_unknown/session_busy_or_uncertain, сверяйте thread на Mac; не очищайте storage и не переключайте session вслепую. `sessionId` в приватном config позволяет явно выбрать проверенную сессию при следующей сборке.

## 11. Что проверено и что ещё требуется

- Структура app.json/Ink, синтаксис JS, imports и UI handlers проверены скриптом.
- Официальный AIX pack выполнен, runtime файлы и MIT license присутствуют, tools/tests/node_modules в AIX отсутствуют.
- 18 frontend-тестов (последний запуск): два prompt одного thread, reopen, lost ACK с прежним UUID, запись pending до network send, WAV совместимость, существующая session, wx headers/JSON parsing, реальный HTTPS gateway с mock Codex, 30-секундный лимит/отмена при hide, upstream audio tests.
- Официальный browser preview runtime 0.18.0 отобразил страницу и ожидаемый setup error без credentials; ошибок JavaScript не выявлено. Это не проверка микрофона RV101.
- Для новой UX-версии 1.0.8 ещё не выполнены: iPhone resource update и физическая проверка жестов/микрофона/HUD/автоматического TTS. Ранее backend-цепочка с очков была подтверждена; private Upload новой версии выполнен и read-back проверен. Доверенный HTTPS endpoint через Quick Tunnel теперь подготовлен и проверен с Mac; сетевое поведение новой UX-сборки необходимо подтвердить отдельно от ранее работавшего backend-сценария.

Ни gateway, ни Codex policy, ни approval маршруты не изменялись. Документированные native speech/API возможности не означают, что текущая прошивка ваших RV101 уже их поддерживает — окончательная проверка проводится после account deployment.

## 12. Deployment без редактирования исходников в браузере

Исходники меняются только filesystem/CLI. Добавлена команда `npm run deploy:rokid` и cloud-only fallback `scripts/rokid-cloud-repackage.mjs`.

Наблюдавшийся контракт Studio 1.1.0 (официальный web bundle 1.4.1):

- `POST /metis/agent/getAIUIAgentList` — package/version metadata;
- `POST /metis/user/oss/getOssSts` — временные upload credentials;
- HTTPS PUT в scoped OSS prefix — source ZIP и AIX;
- `POST /metis/agent/updateThirdAgent` — сохранить private version;
- GET URL из `filePath` — скачать именно активный cloud AIX и сверить MD5/содержимое.

В браузере Repackage выполняет клиентскую упаковку и загрузку, а не отдельный серверный build job. CLI использует официальный aix-cli, сохраняет permissions/Camera и состояние draft, проверяет конфликт версии до mutation и не вызывает review/publication API.

CLI читает agentId/expectedOwnerId из ignored `.local/rokid-deploy.json`. Авторизация — из приватного mode-0600 файла, заданного `ROKID_ACCESS_TOKEN_FILE`, или из уже доступного loopback CDP endpoint `ROKID_CDP_URL` с авторизованной Studio. Это Rokid account session, не gateway device token. Не помещать его в argv или Git. CLI не запускает/не перезапускает Chrome и не экспортирует всю cookie-базу.

**Граница проверки:** локальные tests/build и реальные metadata/STС API подтверждены. Полный HTTP upload-путь CLI пока не подтверждён реальным запуском: у текущего Chrome нет прямого CLI CDP listener, а попытка одноразового loopback auth bridge не завершилась; bridge остановлен, browser security не менялась. Не считать наличие скрипта доказательством рабочего unattended deploy. Для текущей 1.0.8 использованы детерминированные Playwright/CDP Repackage/Save в авторизованной Studio, затем обычный CLI download/verify. Cloud-only fallback требует уже загруженных исходников и принимает tab adapter с документированным Playwright/CDP интерфейсом; он не редактирует файлы.

В текущем cloud AIX 1.0.8 проверены все шесть изменённых runtime/metadata файлов, отсутствие кнопок, автоматический вызов TTS, неизменность endpoint/token и permissions. Проверка JSON учитывает только форматирование упаковщика. Детальный отчёт — ignored `.local/voice-ux-deploy-result.json`. [GitHub main](https://github.com/drthalas/rokid_agent/tree/main) — source of truth; автоматический GitHub→AIUI sync не предполагается.
