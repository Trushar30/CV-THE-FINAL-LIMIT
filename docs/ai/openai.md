# OpenAI API Official Documentation & Integration Specification

This document details the official OpenAI API findings, endpoints, authentication mechanisms, structured output protocols, and error normalization rules relied upon by `OpenAIAdapter`.

---

## 1. Official Documentation & REST Specifications

### 1.1 Official Guides & API References

- **Text Generation Guide:** [OpenAI Text Generation Guide](https://platform.openai.com/docs/guides/text-generation)
- **API Reference (Chat Completions):** [OpenAI API Reference — Create Chat Completion](https://platform.openai.com/docs/api-reference/chat/create)
- **Structured Outputs Guide:** [OpenAI Structured Outputs Guide](https://platform.openai.com/docs/guides/structured-outputs)
- **Error Codes Reference:** [OpenAI API Error Codes](https://platform.openai.com/docs/guides/error-codes)
- **Models Endpoint:** [OpenAI API Reference — Retrieve Model](https://platform.openai.com/docs/api-reference/models/retrieve)

### 1.2 Base Endpoint & HTTP Methods

- **Base URL:** `https://api.openai.com/v1`
- **Chat Completions Endpoint:**
  ```http
  POST https://api.openai.com/v1/chat/completions
  ```
- **Model Info / Health Check Endpoint:**
  ```http
  GET https://api.openai.com/v1/models/{model}
  ```

---

## 2. Authentication & Credential Security

- **Official Header:** `Authorization: Bearer <OPENAI_API_KEY>`
- **Security Requirement:** The API key MUST be passed exclusively via the standard HTTP `Authorization` header.
- **Credential Hygiene:** The API key must never be logged, printed to console, or embedded in `AIError` messages or audit entries.

---

## 3. Request Format & Payload Mapping

### 3.1 Mapping `AIRequest` to OpenAI Chat Completions Body

An incoming internal `AIRequest` maps to OpenAI's JSON payload as follows:

```json
{
  "model": "<configured-model-id>",
  "messages": [
    {
      "role": "system",
      "content": "<systemInstruction>"
    },
    {
      "role": "user",
      "content": "<userInput (with serialized context prepended if present)>"
    }
  ],
  "temperature": 0.2,
  "max_tokens": 2048,
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "response_schema",
      "strict": true,
      "schema": { ... }
    }
  }
}
```

### 3.2 Key Differences from Google Gemini:

1. **Endpoint:** Single fixed URL `https://api.openai.com/v1/chat/completions` with `"model"` in the request body (Gemini places the model in the URL path).
2. **Messages:** OpenAI expects an array of message objects with `"role"` (`system`, `user`, `assistant`) and `"content"` string (Gemini uses `system_instruction.parts` and `contents.parts`).
3. **Structured Outputs:** OpenAI uses `response_format: { type: "json_schema", json_schema: { name, strict, schema } }` (Gemini uses `generationConfig.responseSchema` and `generationConfig.responseMimeType: "application/json"`).
4. **Token Limits:** OpenAI uses `max_tokens` (or `max_completion_tokens`), while Gemini uses `maxOutputTokens`.

---

## 4. Structured Output Protocol

- **Official Documentation:** [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
- When `request.outputSchema` is provided:
  - Inject `response_format`:
    ```json
    {
      "type": "json_schema",
      "json_schema": {
        "name": "structured_response",
        "strict": true,
        "schema": "<request.outputSchema>"
      }
    }
    ```
- When `outputSchema` is NOT specified:
  - Omit `response_format`.
- **Extraction:**
  - Content text is retrieved from `choices[0].message.content`.
  - When `outputSchema` is requested, `JSON.parse(content)` produces `structuredData`.

---

## 5. Token Usage Tracking (`usage`)

OpenAI returns token consumption in the top-level `usage` object:

```json
{
  "usage": {
    "prompt_tokens": 128,
    "completion_tokens": 64,
    "total_tokens": 192
  }
}
```

- **Mapping to `AIResponse.usage`:**
  - `inputTokens`: `usage.prompt_tokens ?? 0`
  - `outputTokens`: `usage.completion_tokens ?? 0`
  - `totalTokens`: `usage.total_tokens ?? (inputTokens + outputTokens)`

---

## 6. Error Handling & Spec Section 21 / 33 Fallback Taxonomy

OpenAI communicates errors via HTTP status codes and a JSON error payload:

```json
{
  "error": {
    "message": "You exceeded your current quota, please check your plan and billing details.",
    "type": "insufficient_quota",
    "param": null,
    "code": "insufficient_quota"
  }
}
```

### 6.1 Mapping Matrix to `AIErrorCategory`

| HTTP Status / Condition  | OpenAI Error Type / Code                   | Category          | Retryable | Fallback Behavior                             |
| ------------------------ | ------------------------------------------ | ----------------- | --------- | --------------------------------------------- |
| **429**                  | `rate_limit_error`, `insufficient_quota`   | `RATE_LIMIT`      | `true`    | Retry with backoff; fallback after 3 attempts |
| **Timeout / AbortError** | N/A (Client Abort)                         | `TIMEOUT`         | `true`    | Retry with backoff; fallback after 3 attempts |
| **500, 502, 504**        | `server_error`, `internal_error`           | `PROVIDER_ERROR`  | `true`    | Retry with backoff; fallback after 3 attempts |
| **503**                  | `service_unavailable`                      | `UNAVAILABLE`     | `true`    | Retry with backoff; fallback after 3 attempts |
| **Network Failure**      | `fetch failed`, `ECONNRESET`               | `NETWORK`         | `true`    | Retry with backoff; fallback after 3 attempts |
| **401, 403**             | `authentication_error`, `permission_error` | `AUTH_CONFIG`     | `false`   | **Fast-fail; DO NOT retry; DO NOT fallback**  |
| **400**                  | `invalid_request_error`                    | `INVALID_REQUEST` | `false`   | **Fast-fail; DO NOT retry; DO NOT fallback**  |
| **404**                  | `not_found_error`, `model_not_found`       | `INVALID_REQUEST` | `false`   | **Fast-fail; DO NOT retry; DO NOT fallback**  |

---

## 7. Timeout Configuration

- Execution uses `AbortController` with `setTimeout` / `signal`.
- Default timeout is configurable (`timeoutMs`, defaulting to `15000` ms).
- If the abort signal triggers, error is mapped to `AIErrorCategory.TIMEOUT` (`retryable: true`).
