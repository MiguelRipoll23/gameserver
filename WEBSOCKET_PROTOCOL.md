# WebSocket Protocol (Game Clients)

This document describes the **binary WebSocket protocol** used by game clients.

> [!IMPORTANT]
> The **first client message MUST be authentication** (`type = 0`). If a non-auth message is sent before authentication, the server closes the socket with code `1008` and reason `Authentication required`.

## Endpoint

- WebSocket route: `/api/v1/websocket/`
- Typical URL:
  - `ws://<host>:<port>/api/v1/websocket/`
  - `wss://<host>/api/v1/websocket/` (TLS)

## Frame format and data types

All messages are sent as **binary frames** (`ArrayBuffer`).

Each frame starts with:

1. `type: uint8` (message discriminator)
2. Message-specific payload fields

Numeric values are encoded **little-endian**.

### Primitive types

- `uint8`: 1 byte unsigned integer.
- `uint16`: 2 byte unsigned integer, little-endian.
- `uint32`: 4 byte unsigned integer, little-endian.
- `bytes[N]`: exactly `N` raw bytes.
- `bytes[...]`: all remaining bytes in the frame.
- `fixedString[N]`:
  - UTF-8 bytes,
  - truncated to `N` bytes if longer,
  - zero-padded (`0x00`) if shorter.
- `varString`:
  - `byteLength: uint32` (4-byte unsigned integer, little-endian)
  - `utf8Bytes: bytes[byteLength]`
  - `byteLength` is the number of UTF-8 encoded bytes, not character count.

## Message type IDs

| Type ID | Name |
|---|---|
| `0` | Authentication |
| `1` | Notification |
| `2` | PlayerIdentity |
| `3` | Tunnel |
| `4` | OnlinePlayers |
| `5` | ChatMessage |
| `6` | UserKicked |

---

## Client -> Server messages

### 0: Authentication (required first)

**Structure**

- `type: uint8 = 0`
- `accessToken: varString` (JWT bearer token)

**Behavior**

- Must be the first client message.
- On invalid token, server closes with code `1008` and reason `Authentication failed`.
- Re-sending auth after success is ignored.

### 2: PlayerIdentity

Request identity data for another player.

**Structure**

- `type: uint8 = 2`
- `destinationToken: bytes[32]` (raw 32-byte token, not base64 text)

### 3: Tunnel Message

Relay opaque binary data to another connected player.

**Structure**

- `type: uint8 = 3`
- `destinationToken: bytes[32]`
- `payload: bytes[...]`

### 5: ChatMessage

Submit chat text to be filtered and signed by the server.

**Structure**

- `type: uint8 = 5`
- `messageText: varString`

**Constraints**

- Message is trimmed server-side.
- Must be non-empty.
- Max length: 35 characters.

---

## Server -> Client messages

### 0: Authentication (ack)

**Structure**

- `type: uint8 = 0`
- `success: uint8` (`1` = success)

### 1: Notification

**Structure**

- `type: uint8 = 1`
- `channel: uint8`
  - `0` = Global
  - `1` = Menu
  - `2` = Match
- `text: bytes[...]` (UTF-8 notification text)

### 2: PlayerIdentity

**Structure**

- `type: uint8 = 2`
- `originToken: bytes[32]` (sender token)
- `networkId: fixedString[32]`
- `name: fixedString[16]`

### 3: Tunnel Message

**Structure**

- `type: uint8 = 3`
- `originToken: bytes[32]`
- `payload: bytes[...]`

### 4: OnlinePlayers

**Structure**

- `type: uint8 = 4`
- `totalOnline: uint16` (0..65535)

### 5: ChatMessage (signed)

Server returns signed chat payload.

**Structure**

- `type: uint8 = 5`
- `authorNetworkId: fixedString[32]`
- `filteredMessageText: varString`
- `timestampSeconds: uint32` (Unix time, seconds)
- `signature: bytes[...]` (ECDSA P-256 / SHA-256 signature)

### 6: UserKicked

Sent to match host when a participant is banned/kicked.

**Structure**

- `type: uint8 = 6`
- `bannedUserNetworkId: fixedString[32]`

---

## Client implementation checklist

- Open socket as binary and parse frames from `ArrayBuffer`.
- Always send `Authentication` as first frame.
- Keep a byte reader with little-endian integer decoding.
- Dispatch parsing by the first `type` byte.
- Treat `Tunnel` payload as opaque bytes.
- Preserve exact byte formatting for tokens (`32` raw bytes in protocol messages).
