# ReqLens API

Платформа для коммуникации **developer ↔ client** с AI-анализом документов.

Все защищённые endpoints требуют заголовка:
```
Authorization: Bearer <access_token>
```

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

**Ошибки:** `401` — неверный email или пароль (один и тот же текст для обоих случаев — защита от user enumeration)

---

## Чаты `/chats`

Чат создаёт **developer**. **Client** присоединяется по `invite_code`.

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

Создаёт новую комнату. Текущий пользователь становится **developer**. `invite_code` генерируется автоматически (URL-safe, 11 символов).

**Тело запроса** `application/json`
```json
{
  "title": "Договор на разработку"
}
```

| Поле | Тип | Обязательно | Описание |
|------|-----|:-----------:|---------|
| `title` | string | — | Название чата (до 255 символов) |

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

Привязывает текущего пользователя как **client** к чату по invite-коду. Один чат — один клиент.

**Path params:** `invite_code` — строка из ссылки-приглашения

**Тело запроса:** не требуется

**Ответ** `200 OK`
```json
{
  "chat": {
    "id": "uuid",
    "title": "...",
    "invite_code": "xK2mN_abc",
    "developer_ids": ["uuid"],
    "client_ids": ["uuid"],
    "ai_analysis_json": null,
    "created_at": "2026-04-25T10:00:00Z",
    "updated_at": "2026-04-25T10:00:00Z"
  },
  "message": "Joined successfully"
}
```

**Ошибки:**
- `404` — чат не найден
- `409` — нельзя вступить в чат, где ты developer, или уже состоишь как client

---

## Сообщения `/chats/{chat_id}/messages`

Доступны только участникам чата (developer или client).

### `GET /chats/{chat_id}/messages` — История сообщений

Возвращает сообщения в хронологическом порядке с пагинацией.

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

> `author_id: null` + `role: "ai"` или `"system"` — машинно-сгенерированное сообщение (команда или AI).

**Ошибки:** `403` — не участник чата, `404` — чат не найден

---

### `POST /chats/{chat_id}/messages` — Отправить сообщение

Сохраняет сообщение и рассылает его всем WebSocket-подписчикам чата в реальном времени. Если прикреплён файл — текст извлекается через **markitdown** и сохраняется в `Attachment`.

**Тело запроса** `multipart/form-data`

| Поле | Тип | Обязательно | Описание |
|------|-----|:-----------:|---------|
| `content` | string | ✓ | Текст сообщения (минимум 1 символ) |
| `file` | file | — | Любой файл (PDF, DOCX, TXT и др.) |

**Ответ** `201 Created`
```json
{
  "id": "uuid",
  "chat_id": "uuid",
  "author_id": "uuid",
  "role": "client",
  "content": "Смотрите прикреплённый документ",
  "timestamp": "2026-04-25T10:10:00Z",
  "attachments": [
    {
      "id": "uuid",
      "filename": "contract.pdf",
      "content_type": "application/pdf"
    }
  ]
}
```

**Ошибки:** `403` — не участник чата, `404` — чат не найден

---

## Команды `/chats/{chat_id}/commands`

Slash-команды запускают AI-операции над контентом чата. Результат сохраняется как сообщение и рассылается по WebSocket.

### `POST /chats/{chat_id}/commands` — Выполнить команду

**Тело запроса** `application/json`
```json
{
  "command": "/update"
}
```

| Значение | Описание |
|---------|---------|
| `/update` | Суммаризирует последние 20 сообщений → сохраняет сообщение с `role: "system"` |
| `/analyze` | Анализирует последний прикреплённый файл (по `chat_id`) → сохраняет сообщение с `role: "ai"` и обновляет `Chat.ai_analysis_json` |

**Ответ** `200 OK`
```json
{
  "command": "/analyze",
  "result": "**Analysis complete** (score: 82/100)\n\nДокумент содержит...\n\n- [HIGH] **Отсутствие сроков**: Добавьте дедлайны...",
  "message": { ...MessageOut }
}
```

**Структура `Chat.ai_analysis_json`** (обновляется после `/analyze`):
```json
{
  "score": 82,
  "document_markdown": "# Техническое задание\n\n...",
  "analysis_markdown": "## Резюме\n\nДокумент содержит...\n\n## Риски\n...",
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
}
```

`severity`: `critical` | `high` | `medium` | `low` | `info`

**Ошибки:**

| Код | Причина |
| --- | ------- |
| `403` | Не участник чата |
| `404` | Чат не найден |
| `422` | Нет сообщений для `/update` или нет файлов для `/analyze` |
| `429` | AI-сервис вернул rate limit — повторите позже |
| `502` | AI-сервис вернул ошибку (неверный API-ключ, невалидный запрос) |
| `503` | AI-сервис недоступен |
| `504` | AI-сервис не ответил вовремя |

---

## WebSocket `/ws`

### `WS /ws/{chat_id}?token=<jwt>` — Подписка на чат

Открывает persistent-соединение для получения новых сообщений в реальном времени. JWT передаётся query-параметром, так как браузерный WebSocket API не поддерживает кастомные заголовки.

**Query params:** `token` — JWT access token

**Поведение:**
- Сервер **push**'ит событие при каждом вызове `POST /chats/{chat_id}/messages` и при выполнении команды
- Клиент может отправлять любые фреймы (ping и т.п.) — сервер их дренирует, но не обрабатывает
- При невалидном или просроченном токене соединение закрывается с кодом `4001`
- Реализация in-memory — работает корректно при одном процессе (одном worker'е)

**Формат входящего события** (JSON):
```json
{
  "id": "uuid",
  "chat_id": "uuid",
  "author_id": "uuid | null",
  "role": "developer | client | ai | system",
  "content": "текст сообщения",
  "timestamp": "2026-04-25T10:15:00Z",
  "attachments": [
    {
      "id": "uuid",
      "filename": "file.pdf",
      "content_type": "application/pdf"
    }
  ]
}
```

---

## Роли и доступы

| Действие | `developer` | `client` |
| -------- | :---------: | :------: |
| Создать чат (становится одним из developers) | ✓ | — |
| Вступить по invite_code (добавляется в clients) | — | ✓ |
| Отправлять сообщения | ✓ | ✓ |
| Выполнять команды `/update`, `/analyze` | ✓ | ✓ |
| Подключиться к WebSocket | ✓ | ✓ |

> Чат поддерживает нескольких developers и нескольких clients. Участие определяется по membership в таблицах `chat_developers` / `chat_clients`.

---

## Коды ошибок AI-сервиса

Все endpoints, вызывающие AI (`/commands`), используют единый маппинг ошибок:

| HTTP | Значение |
| ---- | -------- |
| `429` | Rate limit на стороне OpenRouter — повторите запрос |
| `502` | Ошибка конфигурации или невалидный запрос к AI |
| `503` | AI-сервис временно недоступен |
| `504` | AI-сервис не ответил в отведённое время |
