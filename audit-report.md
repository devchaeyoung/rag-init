## 🔍 npm audit 보고서

⚠️ **6건**의 취약점이 발견되었습니다.

### 📊 요약

| 심각도 | 건수 |
|--------|------|
| 🟡 Moderate | **6**건 |

> 📦 전체 831개 패키지 (prod: 236, dev: 585)

### 📋 취약점 상세

| 심각도 | 패키지 | 취약점 | 의존성 | 수정 가능 |
|--------|--------|--------|--------|-----------|
| 🟡 moderate | @angular-devkit/core (12.0.0-next.0 - 21.1.4 || 21.2.0-next.0 - 21.2.0-rc.2) | - | 간접 | ⚠️ --force (@nestjs/schematics@7.3.1) |
| 🟡 moderate | @angular-devkit/schematics (12.0.0-next.0 - 21.1.4 || 21.2.0-next.0 - 21.2.0-rc.2) | - | 간접 | ✅ npm audit fix |
| 🟡 moderate | @angular-devkit/schematics-cli (0.1200.0-next.0 - 21.1.4 || 21.2.0-next.0 - 21.2.0-rc.2) | - | 간접 | ✅ npm audit fix |
| 🟡 moderate | @nestjs/cli (>=8.0.0) | - | 직접 | ⚠️ --force (@nestjs/cli@7.6.0) |
| 🟡 moderate | @nestjs/schematics (>=8.0.0) | - | 직접 | ⚠️ --force (@nestjs/schematics@7.3.1) |
| 🟡 moderate | ajv (7.0.0-alpha.0 - 8.17.1) | [ajv has ReDoS when using `$data` option](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6) | 간접 | ⚠️ --force (@nestjs/schematics@7.3.1) |

### 💡 권장 조치

- ✅ npm audit fix로 해결 가능: **2건**
- ⚠️ Breaking change 수반 (npm audit fix --force): **4건**

> 🤖 자동 생성된 보고서입니다.