# Fixtures

`test:pipeline`과 `test:pipeline:batch`는 transcript fixture를 읽어 `runTranscriptPipeline()`을 실행합니다.

## 파일 규약

- transcript: `*.md` 또는 `*.txt`
- expectation(optional): 같은 basename의 `*.expect.json`

예:

- `explanation-harness.md`
- `explanation-harness.expect.json`

## expectation 형식

```json
{
  "expectedDecision": "proceed",
  "expectedDocType": "explanation",
  "mustInclude": ["부수효과 분리"],
  "mustAvoid": ["summarizeSession", "plugin/wiki-forge"]
}
```

## 실행 예시

```bash
npm run test:pipeline -- fixtures/explanation-harness.md --verbose
npm run test:pipeline:batch -- fixtures --save-artifact
```
