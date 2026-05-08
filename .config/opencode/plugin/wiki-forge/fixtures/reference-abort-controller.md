user: fetch 요청을 취소하는 패턴을 정리하고 싶어. 문서에는 일반적인 Web API 이름은 남겨도 되지만, 이번 프로젝트 내부 함수명은 빼고 싶어.

assistant: 그러면 AbortController를 중심으로 정리하는 reference 성격의 항목이 적합해. 이 개념이 해결하는 문제는 오래 걸리는 비동기 요청을 더 이상 필요하지 않을 때 중단해 네트워크 낭비와 늦은 응답 처리 부담을 줄이는 거야.

user: 문서에는 어떤 내용이 들어가야 해?

assistant: AbortController가 무엇인지, AbortSignal이 어떤 역할을 하는지, fetch와 어떻게 연결되는지, 언제 쓰고 어떤 한계가 있는지 정도가 핵심이야. 필요하면 짧은 pseudocode를 넣어도 되지만 실제 앱 코드 복붙은 피하는 게 좋아.

user: React나 프레임워크 얘기는 없어도 되겠지?

assistant: 이 주제의 핵심이 Web API 자체라면 없어도 돼. 다만 검색성과 재참조성을 위해 AbortController, AbortSignal, fetch 같은 표준 API 이름은 명시하는 게 오히려 좋아.

user: 결국 이 문서는 어떤 판단을 빠르게 도와야 할까?

assistant: 오래 걸리는 요청을 취소해야 하는 상황인지, 단순히 응답을 무시하면 되는 상황인지, 그리고 취소 신호를 어느 경계에서 전달해야 하는지를 빠르게 판단할 수 있게 해주면 좋아.
