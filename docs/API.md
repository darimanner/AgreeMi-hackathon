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
| `name` | string | ✓ | Отображаемое имя |
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

Чат создаёт **developer**. **Client** присоединяется по `invite_code`.

### `GET /chats` — Список чатов

Возвращает все чаты, где текущий пользователь является developer или client.

**Ответ** `200 OK`
```json
[
  {
    "id": "uuid",
    "title": "Проект X",
    "invite_code": "abc123def",
    "developer_id": "uuid",
    "client_id": "uuid | null",
    "created_at": "2026-04-24T10:00:00Z"
  }
]
```

---

### `POST /chats` — Создать чат

Создаёт новую комнату. Текущий пользователь становится **developer**. `invite_code` генерируется автоматически.

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
  "developer_id": "uuid",
  "client_id": null,
  "ai_analysis_json": null,
  "created_at": "2026-04-24T10:00:00Z",
  "updated_at": "2026-04-24T10:00:00Z"
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
  "chat": { ...ChatOut },
  "message": "Joined successfully"
}
```

**Ошибки:**
- `404` — чат не найден
- `409` — нельзя вступить в собственный чат или чат уже занят

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
    "timestamp": "2026-04-24T10:05:00Z",
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

> `author_id: null` и `role: "ai"` или `"system"` — машинно-сгенерированное сообщение.

---

### `POST /chats/{chat_id}/messages` — Отправить сообщение

Сохраняет сообщение и рассылает его всем WebSocket-подписчикам чата. Поддерживает прикрепление файла — текст извлекается через **markitdown** и сохраняется в `Attachment`.

**Тело запроса** `multipart/form-data`

| Поле | Тип | Обязательно | Описание |
|------|-----|:-----------:|---------|
| `content` | string | ✓ | Текст сообщения (минимум 1 символ) |
| `file` | file | — | Любой файл (PDF, DOCX и др.) |

**Ответ** `201 Created`
```json
{
  "id": "uuid",
  "chat_id": "uuid",
  "author_id": "uuid",
  "role": "client",
  "content": "Смотрите прикреплённый документ",
  "timestamp": "2026-04-24T10:10:00Z",
  "attachments": [
    {
      "id": "uuid",
      "filename": "contract.pdf",
      "content_type": "application/pdf"
    }
  ]
}
```

**Ошибки:** `403` — пользователь не является участником чата

---

## Команды `/chats/{chat_id}/commands`

Slash-команды запускают AI-операции над контентом чата.

### `POST /chats/{chat_id}/commands` — Выполнить команду

**Тело запроса** `application/json`
```json
{
  "command": "/update"
}
```

| Значение | Описание |
|---------|---------|
| `/update` | Суммаризирует последние 20 сообщений → сохраняет `system`-сообщение |
| `/analyze` | Анализирует последний прикреплённый файл через AI → сохраняет `ai`-сообщение и структурированный результат в `Chat.ai_analysis_json` |

**Ответ** `200 OK`
```json
{
  "command": "/analyze",
  "result": "**Analysis complete** (score: 82/100)\n\nДокумент содержит...\n\n- [HIGH] **Отсутствие сроков**: Добавьте дедлайны...",
  "message": { ...MessageOut }
}
```

**Структура `ai_analysis_json`** (обновляется на Chat после `/analyze`):
```json
{
  "score": 82,
  "summary": "Краткое описание документа...",
  "issues": [
    {
      "id": "ISSUE-1",
      "severity": "high",
      "title": "Отсутствие сроков",
      "description": "В ТЗ не указаны сроки выполнения этапов",
      "suggestion": "Добавить дедлайны для каждого milestone"
    }
  ]
}
```

**Ошибки:**
- `422` — нет сообщений (`/update`) или нет файлов (`/analyze`)
- `502` — ошибка AI-сервиса

---

## WebSocket `/ws`

### `WS /ws/{chat_id}?token=<jwt>` — Подписка на чат

Открывает persistent-соединение для получения новых сообщений в реальном времени. JWT передаётся query-параметром (браузерный WebSocket API не поддерживает заголовки).

**Query params:** `token` — JWT access token

**Поведение:**
- Сервер **push**'ит сообщения при каждом вызове `POST /chats/{chat_id}/messages` или выполнении команды
- Клиент может отправлять любые фреймы (ping и т.п.) — сервер их дренирует, но не обрабатывает
- При невалидном токене соединение закрывается с кодом `4001`

**Формат входящего события** (JSON):
```json
{
  "id": "uuid",
  "chat_id": "uuid",
  "author_id": "uuid | null",
  "role": "developer | client | ai | system",
  "content": "текст сообщения",
  "timestamp": "2026-04-24T10:15:00Z",
  "attachments": []
}
```

---

## Роли и доступы

| Роль | Создаёт чат | Вступает по коду | Отправляет сообщения |
|------|:-----------:|:----------------:|:--------------------:|
| `developer` | ✓ | — | ✓ |
| `client` | — | ✓ | ✓ |

Обе роли могут выполнять slash-команды и подключаться к WebSocket.
