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

Numeric values are encoded **big-endian**.

### Primitive types

- `uint8`: 1-byte unsigned integer.
- `uint16`: 2-byte unsigned integer, big-endian.
- `uint32`: 4-byte unsigned integer, big-endian.
- `bytes[N]`: exactly `N` raw bytes.
- `bytes[...]`: all remaining bytes in the frame.
- `fixedString[N]`:
  - UTF-8 bytes,
  - truncated to `N` bytes if longer,
  - zero-padded (`0x00`) if shorter.
- `varString`:
  - `byteLength: uint32` (4-byte unsigned integer, big-endian)
  - `utf8Bytes: bytes[byteLength]`
  - `byteLength` is the number of UTF-8 encoded bytes, not character count.

### Clarifications

- `networkId`, `authorNetworkId`, and `bannedUserNetworkId` are all the user's UUID represented as a 32-character hexadecimal string (without dashes), encoded as `fixedString[32]`.

## Message type IDs

| Type ID | Name |
|---|---|
| `0` | Authentication |
| `1` | OnlinePlayers |
| `2` | PlayerIdentity |
| `3` | PlayerRelay |
| `4` | ChatMessage |
| `5` | PlayerKicked |
| `6` | Notification |

---

## Client -> Server messages

### Authentication (required first)

**Structure**

- `type: uint8 = 0`
- `accessToken: varString` (JWT bearer token)

**Behavior**

- Must be the first client message.
- On invalid token, server closes with code `1008` and reason `Authentication failed`.
- Re-sending auth after success is ignored.

### PlayerIdentity

Request identity data for another player.

**Structure**

- `type: uint8 = 2`
- `destinationToken: bytes[32]` (raw 32-byte opaque session token, not base64 text)
  - The server generates a random 32-byte token for each WebSocket connection.
  - In some APIs/logs this token may appear base64-encoded; on the wire here it is always raw bytes.

### PlayerRelay

Relay opaque binary data to another connected player.

**Structure**

- `type: uint8 = 3`
- `destinationToken: bytes[32]`
- `payload: bytes[...]`

### ChatMessage

Submit chat text to be filtered and signed by the server.

**Structure**

- `type: uint8 = 4`
- `messageText: varString`

**Constraints**

- Message is trimmed server-side.
- Must be non-empty.
- Max length: 35 UTF-16 code units (JavaScript `string.length`, server-side validation).
- This is not a UTF-8 byte limit and not a Unicode code-point/grapheme-cluster limit.

---

## Server -> Client messages

### Authentication (ack)

**Structure**

- `type: uint8 = 0`
- `reserved: uint8 = 0`
- `signature: bytes[...]` — ECDSA P-256 / SHA-256 signature over the payload `[token: bytes[32]][networkId: fixedString[32]][userName: fixedString[16]]`, where `token` is the session token received by the server on connection.

**Purpose**

The signature is a server-issued credential the client must present when joining a peer-to-peer match. The match host verifies it to confirm the joining player's identity was authenticated by the server.

**Client implementation note**

Skip the `reserved` byte before reading the signature:

```
binaryReader.unsignedInt8(); // discard reserved byte
const signature = binaryReader.bytesAsArrayBuffer();
```

> [!WARNING]
> Do **not** use an absolute-seek call (e.g. `seek(1)`) to skip this byte if the reader position has already been advanced past the `type` byte. Use a relative read instead.

### OnlinePlayers

**Structure**

- `type: uint8 = 1`
- `totalOnline: uint16` (0..65535)

### PlayerIdentity

**Structure**

- `type: uint8 = 2`
- `originToken: bytes[32]` (sender token)
- `networkId: fixedString[32]`
- `name: fixedString[16]`

### PlayerRelay

**Structure**

- `type: uint8 = 3`
- `originToken: bytes[32]`
- `payload: bytes[...]`

### ChatMessage (signed)

Server returns signed chat payload.

**Structure**

- `type: uint8 = 4`
- `authorNetworkId: fixedString[32]`
- `filteredMessageText: varString`
- `timestampSeconds: uint32` (Unix time, seconds)
- `signature: bytes[...]` (ECDSA P-256 / SHA-256 signature, ASN.1 DER-encoded as returned by WebCrypto `subtle.sign`)

### PlayerKicked

Sent to match host when a participant is banned/kicked.

**Structure**

- `type: uint8 = 5`
- `bannedUserNetworkId: fixedString[32]`

### Notification

**Structure**

- `type: uint8 = 6`
- `channel: uint8`
  - `0` = Global
  - `1` = Menu
  - `2` = Match
- `text: bytes[...]` (UTF-8 notification text)

---

## Client implementation checklist

- Open socket as binary and parse frames from `ArrayBuffer`.
- Always send `Authentication` as first frame.
- Keep a byte reader with big-endian integer decoding.
- Dispatch parsing by the first `type` byte.
- Treat `PlayerRelay` payload as opaque bytes.
- Preserve exact byte formatting for tokens (`32` raw bytes in protocol messages).
