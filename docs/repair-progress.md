# BetterLife — შეკეთების პროგრესი

ბოლო განახლება: 2026-11-22. მასობრივი შეკეთება არ დაწყებულა. Commit, push და deployment არ გაკეთებულა. პარალელური აგენტები არ გაშვებულა.

## მიმდინარე სტატუსი

რეპოზიტორია იზოლირებულია `better-life` საქაღალდეში. Git worktree-ით იზოლირებული პარალელური მუშაობა **BLOCKED**-ია, რადგან საწყისი commit არ არსებობს და ის თვითნებურად არ შექმნილა.

უსაფრთხო ალტერნატივა, სანამ commit არ იქნება ცალკე დამტკიცებული: ერთი სამუშაო ხე, ქვემოთ ჩამოთვლილი ექსკლუზიური საზღვრები და წამყვანი ინჟინრის მიერ მინიჭებული არაგადამკვეთი დავალებები. ერთსა და იმავე ფაილზე ორი აგენტი ერთად არ მუშაობს.

## Git-ის აუდიტი

| შემოწმება | შედეგი |
| --- | --- |
| პროექტის ფესვი | `C:\Users\davit\Desktop\better-life` |
| აუდიტამდე Git-ის ფესვი | `C:\Users\davit\Desktop` |
| აუდიტის შემდეგ Git-ის ფესვი ამ საქაღალდეში | `C:\Users\davit\Desktop\better-life` |
| ახალი Git-დირექტორია | `C:\Users\davit\Desktop\better-life\.git` |
| ახალი შტო | `main`, commit-ის გარეშე |
| ახალი remote | არ არის |
| Desktop-ის `HEAD` | `58b8ddea4be56482ac0b0a81b782015ff36a45d0` (`master`) |
| Desktop-ის `main` და `refs/remotes/origin/main` | `474becb8fa8df63d1c551f79ed1cea69bba23b53` |
| Desktop-ის remote URL | კონფიგურაციაში არ არის; remote-tracking ref შეუცვლელია |
| `better-life` Desktop-ის ისტორიაში | არ ჩანს |
| Desktop-ის მიმდინარე tracked ფაილები | 0 (`master` ცარიელი commit-ია) |

Desktop-ის `main` უცხო, რვაფაილიანი სარეგისტრაციო ხეა და ამ Next.js პროექტს არ ეკუთვნის. ის ობიექტები არ გადმოწერილა და არ გადატანილა.

`HEAD`, `config` და `index` Desktop-ის `.git`-ში init-ის წინ და შემდეგ იგივე SHA-256 ჰეშით დარჩა:

- `HEAD`: `F6F2B945F6C411B02BA3DA9C7ACE88DCF71B6AF65BA2E0D89AA82900042B5A10`
- `config`: `05BECDB83BB897F6103C8D91439E2E9092144EDF5B3955A746FCE4975C12BFDC`
- `index`: `FE12AD6ADA05016C6539719BB6B02E6B45404EAE7C2230D11EB7340F4DAA7FF8`

Desktop-იდან `better-life` ჩანს როგორც ერთი untracked ჩადგმული საქაღალდე. იქიდან `git add better-life` არ უნდა გაეშვას: ის შექმნის gitlink-ს. Git ბრძანებები ეშვება მხოლოდ `better-life`-ის შიგნით.

`.gitignore` უკვე ფარავს `node_modules/`, `.next/`, `.qa/`, `.local/`, `.env*` და `src/generated/prisma/`-ის შიგთავსს. `.local/` შეიცავს ლოკალური ბაზის საიდუმლოებს და რეპოზიტორიაში არ შედის.

## რა მომზადდა

- დამოუკიდებელი ცარიელი რეპოზიტორია: `git init -b main`.
- ოთხი აგენტის კონფიგურაცია `.cursor/agents/`-ში.
- ეს ჟურნალი.

## Worktree — BLOCKED

`git worktree add` საწყის commit-ს მოითხოვს. შემოწმებამ დააბრუნა `fatal: invalid reference: HEAD` და საცდელი დირექტორია არ შექმნილა.

საწყისი commit ამ ეტაპზე არ გაკეთდება. ის მომხმარებლის ცალკე თანხმობას საჭიროებს. თანხმობის შემდეგ, commit-მდე უნდა ნახოს `git status` და დარწმუნდეს, რომ staged სიაში არ არის `.env*`, `.local/` ან `.next/`.

## აგენტების საზღვრები

| აგენტი | წერის საზღვარი |
| --- | --- |
| `infrastructure-engineer` | `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `.gitignore`, `README.md`, `AGENTS.md`, `scripts/**` გარდა `scripts/db/**` |
| `database-engineer` | `prisma/**`, `prisma.config.ts`, `src/lib/db.ts`, `scripts/db/**`, `tests/integration/database.test.ts` |
| `security-engineer` | `src/modules/identity/**`, `src/proxy.ts`, `src/app/[locale]/auth/**`, `src/app/[locale]/(identity)/**`, `src/modules/media/**`, `src/app/api/**`, `messages/identity/**` |
| `frontend-lms-engineer` | `src/components/**`, `src/i18n/**`, `messages/ka.json`, `messages/en.json`, `messages/learning/**`, `public/**`, `docs/visual-inventory.md`, ლოკალის გვერდები გარდა auth/identity-ისა, `src/modules/catalog/**`, `src/modules/learning/**` |

საერთო ზონა, რომელსაც წამყვანი ცალკე დავალებით აძლევს ერთ მფლობელს:

- `src/app/[locale]/account/page.tsx`
- `src/app/[locale]/manage/actions.ts`
- `tests/integration/learning.test.ts`

`src/generated/prisma/**` ხელით არ იცვლება. `.cursor/agents/**` და ეს ფაილი მხოლოდ წამყვან ინჟინერს ეკუთვნის.

## ჟურნალის წესი

აგენტი პროგრესს აბრუნებს საკუთარ ანგარიშში. ამ ფაილში ჩანაწერს ამატებს წამყვანი ინჟინერი, დავალების დასრულების შემდეგ. ჩანაწერში არ ხვდება საიდუმლო, კავშირის სტრიქონი ან cookie.

## ჯერ არ დაწყებულა

- პროექტის მასობრივი შეკეთება.
- საწყისი commit და worktree-ები.
- push და deployment.
- პარალელური აგენტების გაშვება.
