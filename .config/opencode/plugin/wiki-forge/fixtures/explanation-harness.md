user: 개인 위키 자동화를 위한 LLM 파이프라인을 검증하려고 해. 실제 모델 호출은 유지하되 저장, 업로드, 알림 같은 부수효과는 끈 상태로 전체 흐름을 확인하고 싶어.

assistant: 그러면 이벤트 기반 orchestrator를 직접 두드리기보다, transcript와 existing docs만 넣어서 고수준 파이프라인을 호출하는 test harness를 두는 편이 좋아. 핵심은 검증 대상과 부수효과를 분리하는 거야.

user: 단순 fixture 기반 오프라인 검증만으로 충분할까?

assistant: 전부 대체할 수는 없지만 상당 부분은 가능해. 오프라인 검증으로 기대 decision, narrow topic, doc type, must include, must avoid를 먼저 정의하고, 이후 소수의 실호출 smoke test로 파싱 안정성과 reviewer 동작을 확인하는 식이 좋아.

user: 나중에 내가 Node script로 바로 실행하고 싶어. 내부 구현이 바뀌어도 테스트 코드는 쉽게 유지됐으면 좋겠어.

assistant: 그럴수록 내부 단계 함수를 테스트에서 직접 엮지 말고, 전체 파이프라인을 대표하는 진입점 하나만 호출해야 해. 테스트 코드는 그 진입점에 transcript fixture를 넣고 classification과 final summary를 확인하는 쪽이 안정적이야.

user: reviewer도 붙어 있는데, 이 경우에는 어떤 정보가 artifact로 남는 게 좋을까?

assistant: classification 결과, reviewer decision, rewrite 발생 여부, 최종 title, tags, markdown 정도는 남기는 게 좋아. 그래야 prompt 튜닝 전후 비교와 regression 확인이 쉬워져.

user: 결국 핵심은 LLM을 실제로 부르되, 파이프라인 코어만 검증 가능한 형태로 분리하는 거네.

assistant: 맞아. 메타 원칙으로 보면, LLM 파이프라인 테스트에서는 모델 호출 자체보다 입력 계약과 부수효과 경계를 안정시키는 쪽이 재사용성과 유지보수성에 더 큰 영향을 준다고 볼 수 있어.
