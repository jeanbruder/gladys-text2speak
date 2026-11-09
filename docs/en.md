# Gladys Assistant integration – Text2Speak

This integration adds a Gladys scene action that sends voice announcements to [Text2Speak](https://github.com/jeanbruder/Text2Speak), a multi-room TTS server.

## Features

- Sends text to `POST /dire`.
- Supports Gladys scene variables: Gladys resolves variables before calling the integration.
- Text2Speak priority from 0 to 9 (0 = highest urgency, 9 = lowest).
- Targets one room, multiple rooms, or a Text2Speak zone.
- An empty target field lets Text2Speak use its configured default target.
- Validates selected rooms and zones through `GET /pieces`.
- Includes a connection-test button in the integration configuration.

## Requirements

- Gladys Assistant 5.1.0 or later.
- A running Text2Speak server reachable from the integration container.
- Docker support for the host architecture (published images target `linux/amd64` and `linux/arm64`).

The current Text2Speak API has no authentication. Keep it on a trusted local network and do not expose it directly to the Internet.

## Installation

1. Install the integration from the Gladys catalog or from its GitHub repository URL.
2. Open the integration Configuration tab.
3. Enter the full API URL, for example `http://192.168.1.50:1337`.
4. Keep the HTTP timeout at 5 seconds or adjust it if required.
5. Click **Test Text2Speak connection**. The result reports the number of detected rooms and zones.

The URL must be reachable from the Gladys integration container. If Text2Speak runs on another host, use that host's LAN IP address or local DNS name, not `localhost`.

## Use in a scene

Add **Integrations → Text2Speak → Speak a message with Text2Speak**.

### Message

Enter the text to speak. Gladys scene variables can be inserted in this field. Gladys resolves them before invoking the integration.

Example:

`Warning: the living room temperature is {{temperature_variable}} degrees.`

The exact variable syntax depends on the scene trigger and preceding steps. Use the variable picker in the Gladys scene editor.

### Priority

An integer from 0 to 9:

| Value | Meaning |
|---:|---|
| 0 | Highest urgency |
| 1–3 | Very high priority |
| 4–6 | Normal |
| 7–9 | Low priority |

At equal priority, Text2Speak preserves arrival order. An urgent message moves ahead of pending messages but does not interrupt the announcement currently playing.

### Rooms and zones

Enter one or more names separated by commas, for example:

- `living_room`
- `kitchen, living_room`
- `ground_floor`
- `whole_house`

Names must match the keys declared in Text2Speak's `pieces.yml`. Names are case-insensitive and whitespace around commas is ignored.

The integration validates targets through `GET /pieces`. Gladys scene-action fields are declarative, so this is a text field validated at runtime rather than a dynamically populated dropdown.

If the field is empty, the `cibles` property is omitted from the request and Text2Speak uses its configured `defaut` target.

## API behavior

For a scene action configured with message `Dinner is ready`, priority `5`, and target `whole_house`, the integration sends:

```json
{
  "dire": "Dinner is ready",
  "priorite": 5,
  "cibles": ["whole_house"]
}
```

Text2Speak normally responds with HTTP `202 Accepted` and a job ID. This means the message was accepted into the queue, not that playback has completed.

The scene action exposes two outputs:
- `job_id`: the Text2Speak job identifier;
- `queue_position`: the queue position returned when accepted.

The integration does not poll for playback completion. Use Text2Speak's `GET /file/<id>` endpoint for playback status.

## Troubleshooting

- **Cannot reach Text2Speak**: check the IP address, port `1337`, Docker networking and firewall rules.
- **Unknown target**: check the `pieces` and `zones` keys in `config/pieces.yml`, then restart Text2Speak after editing the file.
- **HTTP 413**: the text exceeds Text2Speak's `TTS_TEXT_MAX_CHARS` limit (500 characters by default).
- **HTTP 503**: the Text2Speak queue is full.
- **Accepted but no sound**: inspect Text2Speak logs and `GET /file/<id>` for per-room playback status.

## Development and publishing

See the root `README.md` for tests, Docker builds and GitHub Container Registry publishing.
