import type { IconName } from "@/components/icon";
import type { Locale } from "@/i18n";

export const publicSlugs = ["about", "teenagers", "adults", "companies", "books", "contact", "privacy", "terms", "refund"] as const;
export type PublicSlug = (typeof publicSlugs)[number];

export const socialLinks = [
  { name: "Facebook", href: "https://www.facebook.com/profile.php?id=61574809048275", icon: "facebook" },
  { name: "TikTok", href: "https://www.tiktok.com/@.hi.better.life", icon: "tiktok" },
  { name: "Instagram", href: "https://www.instagram.com/hi.betterlife/", icon: "instagram" },
  { name: "YouTube", href: "https://www.youtube.com/@hibetterlife", icon: "youtube" },
  { name: "LinkedIn", href: "https://www.linkedin.com/in/hi-better-life-29b30335a/", icon: "linkedin" },
  { name: "Mail", href: "mailto:info.hibetterlife@gmail.com", icon: "mail" },
] as const satisfies readonly { name: string; href: string; icon: IconName }[];

export type PublicBlock =
  | { type: "h"; level: 2 | 3; text: string }
  | { type: "p"; text: string }
  | { type: "list"; items: string[] }
  | { type: "mail"; address: string };

type PageCopy = {
  metaTitle: string;
  metaDescription: string;
  eyebrow?: string;
  title: string;
  image?: { src: string; width: number; height: number };
  blocks: PublicBlock[];
  /** Heading above the social links. Omitted pages do not show them. */
  social?: string;
  books?: { id: string; title: string; price: string; cover: string }[];
  contact?: {
    phone: string;
    email: string;
    form: { name: string; surname: string; email: string; phone: string; message: string; submit: string };
  };
};

const books = [
  { id: "decisions-en", title: "Life is colored by the right decisions", price: "25,00 ₾", cover: "/brand/decisions-en.webp" },
  { id: "roles-en", title: "People over roles — not roles over people.", price: "35,00 ₾", cover: "/brand/roles-en.webp" },
  { id: "roles-ka", title: "როლი ადამიანზე და არა ადამიანი როლზე", price: "35,00 ₾", cover: "/brand/roles-ka.webp" },
  { id: "decisions-ka", title: "ცხოვრებას აფერადებს სწორი გადაწყვეტილებები", price: "25,00 ₾", cover: "/brand/decisions-ka.webp" },
];

const ka: Record<PublicSlug, PageCopy> = {
  about: {
    metaTitle: "კომპანიის შესახებ",
    metaDescription: "ჩვენი მუშაობა ეფექტურია, რადგან ორიენტირებულები ვართ მხოლოდ თქვენზე და თქვენს მიზნებზე.",
    title: "კომპანიის შესახებ",
    image: { src: "/brand/about.jpg", width: 1024, height: 1536 },
    blocks: [
      { type: "h", level: 2, text: "რატომ უნდა შეაჩერო არჩევანი ჩვენზე" },
      { type: "p", text: "ჩვენი მუშაობა ეფექტურია, რადგან ორიენტირებულები ვართ მხოლოდ თქვენზე და თქვენს მიზნებზე." },
      { type: "p", text: "ჩვენ გაძლევთ შესაძლებლობას ფოკუსირება მოახდინოთ მხოლოდ თქვენს განვითარებაზე. განვითარება კი ჩვენთან ნიშნავს, გახდეთ ის, ვინც გინდათ, რომ იყოთ და არ მიჰყვეთ სტერეოტიპულ პროცესებს. გეხმარებით გახდეთ ის, ვინც გინდათ, რომ იყოთ." },
      { type: "p", text: "ჩვენი მწვრთნელი თანამგრძნობი და ამავდროულად მომთხოვნი პიროვნებაა, რომლის გონებაც მუშაობის პროცესში მიმართულია იდეებსა და გზების პოვნაზე, როგორ მიგიყვანოთ დასახულ მიზნამდე." },
      { type: "p", text: "გეძლევათ სრულიად სხვაგვარი პერსპექტივა, გაიფართოვოთ თვალსაწიერი და უფრო სიღრმისეულად დაინახოთ, თუ ვინ ხართ სინამდვილეში. ეს კი წარმატებისკენ მიმავალ გზაზე, პირველი ნაბიჯის გადადგმამდე აუცილებელი წინაპირობაა." },
      { type: "p", text: "მიზნების ჩამოყალიბების შემდეგ, ჩვენ ანგარიშვალდებულს გხდით საკუთარ თავთან და გადასადგმელ ნაბიჯებთან." },
      { type: "p", text: "დროთა განმავლობაში თქვენ მიერ მიზნების მისაღწევად განხორციელებული დადებითი ქმედებები, მეორე მიზანი ხდება. ეფექტური მოქმედებები იქცევა სტრუქტურირებულ ჩვევებსა და სისტემებში , უწყვეტი ზრდისა და განვითარებისთვის." },
      { type: "p", text: "ჩვენი მუშაობა არ არის მხოლოდ უკმაყოფილების მოგვარება და პრობლემების იდენტიფიცირება. ეს ასევე ეხება კმაყოფილებას თქვენი ძლიერი მხარეებით, თქვენი მიღწევებითა და პოტენციალით." },
      { type: "p", text: "თქვენი მწვრთნელი იქნება ის ერთადერთი ადამიანი, რომლებსაც თქვენი ისტორია მხოლოდ თქვენი სამომავლო კეთილდღეობისთვის აინტერესებს.ის არ განგიკითხავთ და არ გაფასებთ, ის გაპოვნინებთ გამოსავალს. თქვენ ავსებთ ისეთ კითხვარებს, რომელიც განცდას გიტოვებთ, რომ ესაუბრებით და უსმენთ საკუთარ თავს." },
      { type: "p", text: "ყველაფერი, რაც ხდება ყველა საჭირო სესიაზე, რჩება 100 %-ით პირადი და კონფიდენციალური. შესანიშნავი ადგილია იმ საკითხების განსახილველად, რომელთან განხილვა სხვაგან ნაკლებ ეფექტურია." },
      { type: "p", text: "ჩვენ გეხმარებით შექმნათ რუქა, უკეთესი ცხოვრებისკენ მიმავალ გზაზე." },
      { type: "p", text: "ჩვენთან მუშაობის შემდეგ, თქვენ შეგიძლიათ დაინახოთ და გაზომოთ შედეგი." },
    ],
  },
  teenagers: {
    metaTitle: "პიროვნული განვითარება მოზარდებისთვის",
    metaDescription: "გზა წარმატებისკენ. ჩვენ ერთად შევძლებთ აირჩიო სწორი პროფესია.",
    eyebrow: "გზა წარმატებისკენ",
    title: "პიროვნული განვითარება მოზარდებისთვის",
    image: { src: "/brand/teenagers.jpg", width: 1187, height: 1536 },
    social: "მეტი ინფორმაციისათვის გამოგვყევით",
    blocks: [
      { type: "h", level: 2, text: "ჩვენ ერთად შევძლებთ" },
      { type: "list", items: [
        "აირჩიო სწორი პროფესია",
        "შენი ძლიერი მხარეებიდან გამომდინარე დაძლიო საკუთარი თავის წარმოჩენის შიში",
        "მართო დისლექსია",
        "დაეუფლო პრეზენტაციის ჩატარების ხელოვნებას",
        "მიზნების ჩამოყალიბების შემდეგ, გახდები ანგარიშვალდებული საკუთარ თავთან და გადასადგმელ ნაბიჯებთან.",
        "განბლოკო საკუთარი შესაძლებლობები და გახადო ისინი შენი წარმატების გასაღებად.",
        "გაიგო რა ძალა აქვს კომუნიკაციას და როგორ გვეხმარება/ ხელს გვიშლის ადამიანებთან ურთიერთობებში.",
      ] },
    ],
  },
  adults: {
    metaTitle: "ცხოვრების მართვა ზრდასრულებისთვის",
    metaDescription: "პირადი და პროფესიული ბალანსი. ერთობლივი მუშაობით, შენ შეძლებ აღმოაჩინო შენი უპირატესობები და ნაკლოვანებები.",
    eyebrow: "პირადი და პროფესიული ბალანსი",
    title: "ცხოვრების მართვა ზრდასრულებისთვის",
    image: { src: "/brand/adults.png", width: 1024, height: 1536 },
    social: "მეტი ინფორმაციისათვის გამოგვყევით",
    blocks: [
      { type: "h", level: 2, text: "პიროვნული განვითარება" },
      { type: "h", level: 3, text: "ერთობლივი მუშაობით, შენ შეძლებ:" },
      { type: "list", items: [
        "აღმოაჩინო შენი უპირატესობები და ნაკლოვანებები.",
        "პასუხი გასცე შეკითხვას, რატომ ხდება ასე, რომ აირჩიე პროფესია ერთი მიმართულებით, მუშაობ სამსახურში მეორე მიმართულებით და ეძებ მესამეს?",
        "რატომ არის ტოქსიკური ადამიანების გაშვება ასე რთული (და აუცილებელი)",
        "ისწავლო, როგორ მიიღო სწორი გადაწყვეტილება",
        "დაეუფლო სწორი კომუნიკაციის ხელოვნებას და გამოიყენო ის, შენი მიზნების მისაღწევად.",
        "განავითარო შენში ინტუიციურობა და კრეატიულობა",
        "სწორად დაისახო მიზანი და მიაღწიო მას",
      ] },
      { type: "h", level: 2, text: "კარიერული განვითარება" },
      { type: "h", level: 3, text: "ერთობლივი მუშაობით, შენ შეძლებ:" },
      { type: "list", items: [
        "გამოკვეთო შენი ძლიერი მხარეები და გამოიყენო ისინი კარიერაში",
        "დაძლიო წარმატებისა და წარუმატებლობის შიში",
        "დაეუფლო სწორი გადაწყვეტილების მიღების ტექნიკებს",
        "დაეუფლო პრეზენტაციის ჩატარების ხელოვნებას",
        "ისწავლო სხეულის ენა",
        "სტრესი აქციო წარმატების იარაღად",
        "არ დაისტრესო ტოქსიკურ ადამიანებთან ურთერთობით, ისწავლო მათთან ურთიერთობის მართვა.",
      ] },
    ],
  },
  companies: {
    metaTitle: "ბიზნესის წარმატება",
    metaDescription: "თუ ხვდები, რომ აზრი აღარ აქვს კომპანიაში ერთი და იმავე სტილით ტრენინგების ჩატარებას. ტრენინგი ტრენინგად რჩება და შედეგს ვერ ხედავ.",
    eyebrow: "პროფესიონალური პროექტები კომპანიებისთვის.",
    title: "ბიზნესის წარმატება",
    image: { src: "/brand/companies.jpg", width: 1086, height: 1536 },
    social: "მეტი ინფორმაციისათვის გამოგვყევით",
    blocks: [
      { type: "p", text: "თუ ხვდები, რომ აზრი აღარ აქვს კომპანიაში ერთი და იმავე სტილით ტრენინგების ჩატარებას. ტრენინგი ტრენინგად რჩება და შედეგს ვერ ხედავ." },
      { type: "p", text: "თუ ანალიზს უკეთებ იმას, რომ ყველა შენი თანამშრომელი ინდივიდია და მას ინდივიდუალური მიდგომა სჭირდება." },
      { type: "h", level: 3, text: "ჩვენ გვაქვს სიახლე!" },
      { type: "p", text: "მოვდივართ თქვენს კომპანიაში და ვაკეთებთ დიაგნოსტიკას. მხოლოდ ამის შემდეგ, საჭიროების მიხედვით, ვგეგმავთ შესაბამის მუშაობას თქვენს გუნდთან და ვამუშავებთ თითოეულ თანამშრომელს საჭიროების მიხედვით." },
      { type: "list", items: [
        "კარიერული ქოუჩინგი.",
        "ჯგუფური ქოუჩინგი",
        "თანატოლების ქოუჩინგი",
        "შესრულების ქოუჩინგი",
        "მაღალი პოტენციალის ან განვითარების ქოუჩინგი",
        "ონბორდინგი ან გარდამავალი ქოუჩინგი",
        "მიზნობრივი ქცევითი ქოუჩინგი",
        "პრეზენტაცია/ საკომუნიკაციო უნარების ქოუჩინგი",
        "პიროვნული განვითარების ქოუჩინგი",
      ] },
    ],
  },
  books: {
    metaTitle: "E-book",
    metaDescription: "E-book. Life is colored by the right decisions. People over roles — not roles over people. როლი ადამიანზე და არა ადამიანი როლზე. ცხოვრებას აფერადებს სწორი გადაწყვეტილებები.",
    eyebrow: "ზრდასრულებისთვის.",
    title: "E-book",
    blocks: [],
    books,
  },
  contact: {
    metaTitle: "კონტაქტი",
    metaDescription: "დამიკავშირდით მეტი ინფორმაციისთვის. 511777165. info.hibetterlife@gmail.com.",
    eyebrow: "კონტაქტი",
    title: "დამიკავშირდით მეტი ინფორმაციისთვის",
    blocks: [],
    social: "მეტი ინფორმაციისათვის გამოგვყევით",
    contact: {
      phone: "511777165",
      email: "info.hibetterlife@gmail.com",
      form: {
        name: "სახელი",
        surname: "გვარი",
        email: "ელ. ფოსტა",
        phone: "ტელ. ნომერი",
        message: "შეიყვანე ტექსტი",
        submit: "გაგზავნა",
      },
    },
  },
  privacy: {
    metaTitle: "კონფიდენციალურობის პოლიტიკა",
    metaDescription: "ჩვენ, Better Life, ვაფასებთ თქვენი პირადი ინფორმაციის დაცვას. ჩვენი საიტი აგროვებს მხოლოდ იმ ინფორმაციას, რაც აუცილებელია კურსების რეგისტრაციის, გადახდის დამუშავებისა და მომხმარებელთან კომუნიკაციისთვის.",
    title: "კონფიდენციალურობის პოლიტიკა",
    blocks: [
      { type: "p", text: "ჩვენ, Better Life, ვაფასებთ თქვენი პირადი ინფორმაციის დაცვას. ჩვენი საიტი აგროვებს მხოლოდ იმ ინფორმაციას, რაც აუცილებელია კურსების რეგისტრაციის, გადახდის დამუშავებისა და მომხმარებელთან კომუნიკაციისთვის – მაგალითად, მომხმარებლის სახელი, ელ.ფოსტა, ტელეფონის ნომერი, გადახდის ინფორმაცია და ა.შ" },
      { type: "p", text: "ეს მონაცემები გამოიყენება მხოლოდ აღნიშნული მიზნებისთვის და არ გადაეცემა მესამე მხარეს, გარდა იმ შემთხვევებისა, როდესაც ეს აუცილებელია გადახდის მომსახურების ან საქართველოს კანონმდებლობის შესაბამისად." },
      { type: "p", text: "თუ გსურთ თქვენი მონაცემების წაშლა ან შეცვლა, დაგვიკავშირდით ელფოსტაზე:" },
      { type: "mail", address: "info@betterlife.ge" },
      { type: "p", text: "ეს პოლიტიკა შესაძლოა განახლდეს პერიოდულად; ცვლილებები გამოქვეყნდება ამავე გვერდზე" },
    ],
  },
  terms: {
    metaTitle: "სერვისის გამოყენების პირობები",
    metaDescription: "ჩვენი საიტის გამოყენებით, თქვენ ეთანხმებით ქვემოთ მოცემულ პირობებს.",
    title: "სერვისის გამოყენების პირობები",
    blocks: [
      { type: "p", text: "ჩვენი საიტის გამოყენებით, თქვენ ეთანხმებით ქვემოთ მოცემულ პირობებს:" },
      { type: "list", items: [
        "მომხმარებელი ვალდებულია მიუთითოს სანდო ინფორმაცია რეგისტრაციისას.",
        "აკრძალულია საიტის მასალის გადაცემა ან გაყიდვა მესამე პირებზე ადმინისტრაციის თანხმობის გარეშე.",
        "Better Life არ აგებს პასუხს მომხმარებლის მოწყობილობაზე წარმოქმნილი ტექნიკური ხარვეზების გამო.",
        "ადმინისტრაცია იტოვებს უფლებას შეაჩეროს ან შეწყვიტოს მომსახურება წესების დარღვევის შემთხვევაში.",
      ] },
      { type: "p", text: "თუ არ ეთანხმებით ამ პირობებს, გთხოვთ, არ გამოიყენოთ ჩვენი სერვისი." },
    ],
  },
  refund: {
    metaTitle: "გადახდისა და თანხის დაბრუნების პოლიტიკა",
    metaDescription: "საიტზე არსებული კურსების შეძენა ხორციელდება უსაფრთხო გადახდის არხებით, მათ შორის საქართველოს ბანკის ონლაინ გადახდის სისტემის მეშვეობით.",
    title: "გადახდისა და თანხის დაბრუნების პოლიტიკა",
    blocks: [
      { type: "p", text: "საიტზე არსებული კურსების შეძენა ხორციელდება უსაფრთხო გადახდის არხებით, მათ შორის საქართველოს ბანკის ონლაინ გადახდის სისტემის მეშვეობით." },
      { type: "p", text: "ყველა ტრანზაქცია მუშავდება ეროვნულ ვალუტაში (GEL)." },
      { type: "p", text: "გადახდის შემდეგ მომხმარებელი იღებს კურსზე წვდომას დაუყოვნებლივ ან მითითებულ ვადაში." },
      { type: "p", text: "თანხის დაბრუნება შესაძლებელია მხოლოდ იმ შემთხვევაში, თუ მომხმარებელმა ვერ მიიღო მომსახურება ტექნიკური ან ადმინისტრაციული შეცდომის გამო. დაბრუნების მოთხოვნა უნდა გაკეთდეს გადახდიდან არაუგვიანეს 7 სამუშაო დღის განმავლობაში ელ.ფოსტაზე:" },
      { type: "mail", address: "info@betterlife.ge" },
      { type: "p", text: "სხვა შემთხვევებში თანხის დაბრუნება არ ხორციელდება. ადმინისტრაცია იტოვებს უფლებას განაახლოს ეს პოლიტიკა ნებისმიერ დროს." },
    ],
  },
};

const en: Record<PublicSlug, PageCopy> = {
  about: {
    metaTitle: "About Us",
    metaDescription: "Our work is effective because we are solely focused on you and your goals.",
    title: "About Us",
    image: { src: "/brand/about.jpg", width: 1024, height: 1536 },
    blocks: [
      { type: "h", level: 2, text: "Why You Should Choose Us" },
      { type: "p", text: "Our work is effective because we are solely focused on you and your goals." },
      { type: "p", text: "We give you the opportunity to focus exclusively on your personal development. Development with us means becoming the person you want to be, without following stereotypical processes. We help you become who you want to be." },
      { type: "p", text: "Our coach is an empathetic and demanding individual, whose mind is dedicated to finding ideas and paths to take you to your goals." },
      { type: "p", text: "You will gain a completely different perspective, expand your vision, and see more deeply who you truly are. This is the essential prerequisite for taking the first step on the road to success." },
      { type: "p", text: "After setting your goals, we hold you accountable to yourself and the steps you need to take." },
      { type: "p", text: "Over time, the positive actions you take to achieve your goals become the second goal. Effective actions turn into structured habits and systems for continuous growth and development." },
      { type: "p", text: "Our work is not just about solving dissatisfaction and identifying problems. It’s also about enjoying your strengths, achievements, and potential." },
      { type: "p", text: "Your coach will be the one person whose interest in your story is solely for your future well-being. They will not judge or evaluate you; they will find solutions for you. You fill out questionnaires that leave you feeling like you are talking to and listening to yourself." },
      { type: "p", text: "Everything that happens in each session remains 100% personal and confidential. It’s the perfect place to discuss issues that are less effective to discuss elsewhere." },
      { type: "p", text: "We help you create a map for the path to a better life." },
      { type: "p", text: "After working with us, you’ll be able to see and measure the results." },
    ],
  },
  teenagers: {
    metaTitle: "Personal Growth for Teenagers",
    metaDescription: "A Path to Success. Together we can choose the right profession.",
    eyebrow: "A Path to Success",
    title: "Personal Growth for Teenagers",
    image: { src: "/brand/teenagers.jpg", width: 1187, height: 1536 },
    social: "Follow us for more information:",
    blocks: [
      { type: "h", level: 2, text: "Together we can" },
      { type: "list", items: [
        "Choose the right profession",
        "Overcome the fear of self-expression based on your strengths",
        "Manage dyslexia",
        "Master the art of giving presentations",
        "After defining your goals, you will become accountable to yourself and the steps you need to take.",
        "Unlock your potential and turn it into the key to your success.",
        "Understand the power of communication and how it helps or hinders our relationships with others.",
      ] },
    ],
  },
  adults: {
    metaTitle: "Life Management for Adults",
    metaDescription: "Balancing Personal and Professional Life. Discover your strengths and weaknesses.",
    eyebrow: "Balancing Personal and Professional Life",
    title: "Life Management for Adults",
    image: { src: "/brand/adults.png", width: 1024, height: 1536 },
    social: "Follow us for more information:",
    blocks: [
      { type: "h", level: 2, text: "Personal Growth" },
      { type: "h", level: 3, text: "With joint effort, you will be able to:" },
      { type: "list", items: [
        "Discover your strengths and weaknesses",
        "Answer the question: Why did you choose a profession in one field, work in another, and search for a third?",
        "Understand why it’s so difficult (yet necessary) to let go of toxic people",
        "Learn how to make the right decisions",
        "Master the art of effective communication and use it to achieve your goals",
        "Develop your intuition and creativity",
        "Set clear goals and achieve them",
      ] },
      { type: "h", level: 2, text: "Career Progression" },
      { type: "h", level: 3, text: "With joint effort, you will be able to:" },
      { type: "list", items: [
        "Identify your strengths and apply them to your career",
        "Overcome the fear of success and failure",
        "Master decision-making techniques",
        "Master the art of giving presentations",
        "Learn body language",
        "Turn stress into a tool for success",
        "Avoid stress when dealing with toxic people and learn how to manage those relationships.",
      ] },
    ],
  },
  companies: {
    metaTitle: "Business Success",
    metaDescription: "If you realize that running the same type of training in your company no longer makes sense—training remains just training, and you don't see results.",
    eyebrow: "Professional Projects for Companies",
    title: "Business Success",
    image: { src: "/brand/companies.jpg", width: 1086, height: 1536 },
    social: "Follow us for more information:",
    blocks: [
      { type: "p", text: "If you realize that running the same type of training in your company no longer makes sense—training remains just training, and you don't see results." },
      { type: "p", text: "If you're analyzing the fact that each of your employees is an individual who needs a tailored approach." },
      { type: "h", level: 3, text: "We have something new!" },
      { type: "p", text: "We come to your company and conduct a diagnosis. Only after that do we design and implement a strategy tailored to your team’s needs, working with each employee individually where necessary." },
      { type: "list", items: [
        "Career Coaching",
        "Group Coaching",
        "Peer Coaching",
        "Performance Coaching",
        "High Potential or Developmental Coaching",
        "Onboarding or Transitional Coaching",
        "Targeted Behavioral Coaching",
        "Presentation / Communication Skills Coaching",
        "Coaching for Personal Growth",
      ] },
    ],
  },
  books: {
    metaTitle: "E-book",
    metaDescription: "E-book. Life is colored by the right decisions. People over roles — not roles over people. როლი ადამიანზე და არა ადამიანი როლზე. ცხოვრებას აფერადებს სწორი გადაწყვეტილებები.",
    eyebrow: "For adults.",
    title: "E-book",
    blocks: [],
    books,
  },
  contact: {
    metaTitle: "Contact",
    metaDescription: "Contact Us for More Information. 511777165. info.hibetterlife@gmail.com.",
    eyebrow: "Contact",
    title: "Contact Us for More Information",
    blocks: [],
    social: "Follow us for more information:",
    contact: {
      phone: "511777165",
      email: "info.hibetterlife@gmail.com",
      form: {
        name: "First Name",
        surname: "Last Name",
        email: "E-mail",
        phone: "phone number",
        message: "Enter text",
        submit: "Send",
      },
    },
  },
  privacy: {
    metaTitle: "Privacy Policy",
    metaDescription: "We, Better Life value the protection of your personal information. Our website collects only the information necessary for course registration, payment processing, and communication with the user.",
    title: "Privacy Policy",
    blocks: [
      { type: "p", text: "We, Better Life value the protection of your personal information. Our website collects only the information necessary for course registration, payment processing, and communication with the user — for example: name, email address, phone number, payment details, and similar data." },
      { type: "p", text: "This data is used solely for the purposes mentioned above and is not shared with third parties, except in cases where it is required for payment processing services or in accordance with the legislation of Georgia." },
      { type: "p", text: "If you wish to delete or update your personal data, please contact us at:" },
      { type: "mail", address: "info@betterlife.ge" },
      { type: "p", text: "This policy may be updated periodically; any changes will be published on this page." },
    ],
  },
  terms: {
    metaTitle: "Terms of Service",
    metaDescription: "By using our website, you agree to the terms outlined below.",
    title: "Terms of Service",
    blocks: [
      { type: "p", text: "By using our website, you agree to the terms outlined below:" },
      { type: "list", items: [
        "The user is required to provide accurate and reliable information during registration.",
        "It is prohibited to share or sell the website’s materials to third parties without the consent of the administration.",
        "Better Life We are not responsible for any technical issues that may occur on the user’s device.",
        "The administration reserves the right to suspend or terminate the service in the event of a violation of the rules.",
      ] },
      { type: "p", text: "If you do not agree with these terms, please do not use our service." },
    ],
  },
  refund: {
    metaTitle: "Payment and Refund Policy",
    metaDescription: "The purchase of courses available on our website is carried out through secure payment channels, including Bank of Georgia through the online payment system.",
    title: "Payment and Refund Policy",
    blocks: [
      { type: "p", text: "The purchase of courses available on our website is carried out through secure payment channels, including Bank of Georgia through the online payment system." },
      { type: "p", text: "All transactions are processed in the national currency (GEL)." },
      { type: "p", text: "After the payment, the user receives access to the course immediately or within the specified timeframe." },
      { type: "p", text: "A refund is possible only if the user did not receive the service due to a technical or administrative error. The refund request must be submitted no later than within 7 business days this period to the following email address:" },
      { type: "mail", address: "info@betterlife.ge" },
      { type: "p", text: "Refunds are not issued in any other circumstances. The administration reserves the right to update this policy at any time." },
    ],
  },
};

export const publicPages: Record<Locale, Record<PublicSlug, PageCopy>> = { ka, en };
