# ReqLens API

Платформа для коммуникации **developer ↔ client** с AI-анализом документов.

Все защищённые endpoints требуют заголовка:
```
Authorization: Bearer <access_token>
```

AI-endpoints (`/commands`, `/analysis/summary`) принимают личный ключ OpenRouter пользователя:
```
X-OpenRouter-Key: sk-or-v1-...
```
Без заголовка используется серверный `AI__API_KEY`; если нет и его, ответ `400`. Ключ не сохраняется и не логируется.

Интерактивная документация: `GET /docs` (Swagger UI).

---

## Аутентификация `/auth`

### `POST /auth/register` — Регистрация

Создаёт новый аккаунт. Email должен быть уникальным.

**Тело запроса** `application/json`
```json
{
  "email": "user@example.com",
  "password": "minlength8",
  "name": "Ivan Petrov",
  "role": "developer"
}
```

| Поле | Тип | Обязательно | Описание |
|------|-----|:-----------:|---------|
| `email` | string | ✓ | Валидный email |
| `password` | string | ✓ | Минимум 8 символов |
| `name` | string | ✓ | Отображаемое имя (1–255 символов) |
| `role` | `client` \| `developer` | — | По умолчанию `client` |

**Ответ** `201 Created`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "Ivan Petrov",
  "role": "developer"
}
```

**Ошибки:** `409` — email уже зарегистрирован

---

### `POST /auth/login` — Вход

Проверяет credentials и возвращает JWT.

**Тело запроса** `application/json`
```json
{
  "email": "user@example.com",
  "password": "minlength8"
}
```

**Ответ** `200 OK`
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer"
}
```

**Ошибки:** `401` — неверный email или пароль

---

## Чаты `/chats`

Чат создаёт **developer**. **Client** присоединяется по `invite_code`. Один чат поддерживает **нескольких** developers и **нескольких** clients.

### `GET /chats` — Список чатов

Возвращает все чаты, где текущий пользователь является developer или client, отсортированные по дате создания (новые первыми).

**Ответ** `200 OK`
```json
[
  {
    "id": "uuid",
    "title": "Проект X",
    "invite_code": "xK2mN_abc",
    "developer_ids": ["uuid", "uuid"],
    "client_ids": ["uuid"],
    "created_at": "2026-04-24T10:00:00Z"
  }
]
```

---

### `POST /chats` — Создать чат

Создаёт новую комнату. Текущий пользователь становится первым **developer**. `invite_code` генерируется автоматически (URL-safe, 11 символов).

**Тело запроса** `application/json`
```json
{
  "title": "Договор на разработку"
}
```

**Ответ** `201 Created`
```json
{
  "id": "uuid",
  "title": "Договор на разработку",
  "invite_code": "xK2mN_abc",
  "developer_ids": ["uuid"],
  "client_ids": [],
  "ai_analysis_json": null,
  "created_at": "2026-04-25T10:00:00Z",
  "updated_at": "2026-04-25T10:00:00Z"
}
```

---

### `POST /chats/join/{invite_code}` — Вступить в чат

Привязывает текущего пользователя как **client** к чату по invite-коду.

**Ответ** `200 OK`
```json
{
  "chat": { "...": "ChatOut" },
  "message": "Joined successfully"
}
```

**Ошибки:**
- `404` — чат не найден
- `409` — уже состоишь в чате как developer или client

---

## Сообщения `/chats/{chat_id}/messages`

Доступны только участникам чата (developer или client).

### `GET /chats/{chat_id}/messages` — История сообщений

**Query params:**

| Параметр | Тип | По умолчанию | Описание |
|---------|-----|:------------:|---------|
| `limit` | int | `50` | Максимум сообщений |
| `offset` | int | `0` | Смещение для пагинации |

**Ответ** `200 OK`
```json
[
  {
    "id": "uuid",
    "chat_id": "uuid",
    "author_id": "uuid | null",
    "role": "developer",
    "content": "Привет, вот ТЗ",
    "timestamp": "2026-04-25T10:05:00Z",
    "attachments": [
      {
        "id": "uuid",
        "filename": "tz.pdf",
        "content_type": "application/pdf"
      }
    ]
  }
]
```

> `author_id: null` + `role: "ai"` или `"system"` — машинно-сгенерированное сообщение.

---

### `POST /chats/{chat_id}/messages` — Отправить сообщение

**Тело запроса** `multipart/form-data`

| Поле | Тип | Обязательно | Описание |
|------|-----|:-----------:|---------|
| `content` | string | ✓ | Текст сообщения (минимум 1 символ) |
| `file` | file | — | Любой файл (PDF, DOCX, TXT и др.) |

**Ответ** `201 Created` — `MessageOut`

---

## Команды `/chats/{chat_id}/commands`

Slash-команды запускают AI-операции. Результат сохраняется как сообщение и рассылается по WebSocket.

### `POST /chats/{chat_id}/commands` — Выполнить команду

**Тело запроса** `application/json`
```json
{ "command": "/analyze" }
```

| Команда | Описание |
|---------|---------|
| `/update` | Суммаризирует последние 20 сообщений → сохраняет `role: "system"` сообщение |
| `/analyze` | Анализирует последний прикреплённый файл → сохраняет `role: "ai"` сообщение, обновляет `Chat.ai_analysis_json`, создаёт новую `AnalysisVersion` |
| `/diff` | Семантически сравнивает две последние версии анализа → сохраняет `role: "ai"` сообщение |

---

**Ответ `/analyze`** `200 OK`
```json
{
  "command": "/analyze",
  "result": "**Analysis complete** (score: 82/100)\n\n...",
  "message": { "...": "MessageOut" },
  "analysis": {
    "score": 82,
    "document_markdown": "# Техническое задание\n\n...",
    "analysis_markdown": "## Резюме\n\n...",
    "findings": [
      {
        "id": "FINDING-1",
        "severity": "high",
        "title": "Отсутствие сроков",
        "explanation": "В ТЗ не указаны сроки выполнения этапов",
        "recommendation": "Добавить дедлайны для каждого milestone",
        "quote": "Исполнитель разрабатывает модуль авторизации.",
        "start_line": 12,
        "end_line": 14
      }
    ]
  },
  "diff": null
}
```

**Ответ `/diff`** `200 OK`
```json
{
  "command": "/diff",
  "result": "**Diff v1 → v2** (score: 60 → 82, +22)\n\n...",
  "message": { "...": "MessageOut" },
  "analysis": null,
  "diff": {
    "old_version": 1,
    "new_version": 2,
    "old_score": 60,
    "new_score": 82,
    "score_delta": 22,
    "summary": "Документ значительно улучшился: добавлены сроки и критерии приёмки.",
    "changes": [
      {
        "change": "removed",
        "title": "Отсутствие сроков",
        "old_severity": "high",
        "new_severity": null,
        "explanation": "Дедлайны для всех этапов теперь указаны явно."
      },
      {
        "change": "added",
        "title": "Нет плана тестирования",
        "old_severity": null,
        "new_severity": "medium",
        "explanation": "Новая версия документа упоминает тестирование, но без конкретных сценариев."
      }
    ]
  }
}
```

`severity`: `critical` | `high` | `medium` | `low` | `info`

`change`: `added` | `removed` | `worsened` | `improved` | `severity_changed` | `unchanged`

**Ошибки команд:**

| Код | Причина |
| --- | ------- |
| `400` | Нет ключа OpenRouter: ни `X-OpenRouter-Key`, ни `AI__API_KEY` |
| `403` | Не участник чата |
| `404` | Чат не найден |
| `422` | Нет сообщений для `/update`; нет файлов для `/analyze`; меньше 2 версий для `/diff` |
| `429` | AI-сервис вернул rate limit |
| `502` | AI-сервис вернул ошибку |
| `503` | AI-сервис недоступен |
| `504` | AI-сервис не ответил вовремя |

---

## Анализ `/chats/{chat_id}/analysis`

### `POST /chats/{chat_id}/analysis/summary` — TODO-список задач по анализу

Генерирует короткий TODO-список (Markdown) из **последней** версии анализа (`AnalysisVersion` с максимальным `version_number`). Задачи отсортированы по критичности (critical → high → medium → low). Никогда не использует кешированные или устаревшие данные.

Требует хотя бы одного предварительного вызова `/analyze`.

**Тело запроса:** не требуется

**Ответ** `200 OK`
```json
{
  "summary": "## TODO\n\n- [ ] Добавить дедлайны для каждого этапа разработки\n- [ ] Уточнить критерии приёмки для модуля авторизации\n- [ ] Описать план тестирования (unit + integration)\n- [ ] Добавить NFR: требования к производительности и безопасности",
  "version": 2,
  "score": 82
}
```

> `summary` возвращается в формате Markdown и содержит 5-10 конкретных actionable задач.

**Ошибки:**

| Код | Причина |
| --- | ------- |
| `400` | Нет ключа OpenRouter: ни `X-OpenRouter-Key`, ни `AI__API_KEY` |
| `403` | Не участник чата |
| `404` | Чат не найден или ни одного `/analyze` ещё не запускалось |
| `429` | AI-сервис вернул rate limit |
| `502` | AI-сервис вернул ошибку или пустой ответ |
| `503` | AI-сервис недоступен |
| `504` | AI-сервис не ответил вовремя |

---

## WebSocket `/ws`

### `WS /ws/{chat_id}?token=<jwt>` — Подписка на чат

**Поведение:**
- Сервер push'ит событие при каждом `POST /messages` и при выполнении любой команды
- При невалидном токене соединение закрывается с кодом `4001`
- In-memory реализация — работает при одном процессе (одном worker'е)

**Формат события** (JSON) — `MessageOut`:
```json
{
  "id": "uuid",
  "chat_id": "uuid",
  "author_id": "uuid | null",
  "role": "developer | client | ai | system",
  "content": "текст",
  "timestamp": "2026-04-25T10:15:00Z",
  "attachments": []
}
```

---

## Роли и доступы

| Действие | `developer` | `client` |
| -------- | :---------: | :------: |
| Создать чат | ✓ | — |
| Вступить по invite_code | — | ✓ |
| Отправлять сообщения | ✓ | ✓ |
| Выполнять `/update`, `/analyze`, `/diff` | ✓ | ✓ |
| Подключиться к WebSocket | ✓ | ✓ |

---

## CORS

По умолчанию разрешены все origins (`*`). Для ограничения задай переменную окружения:

```
CORS__ORIGINS=["http://localhost:3000","http://localhost:5173"]
```
