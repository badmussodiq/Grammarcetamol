export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'How do I enroll in a course?',
    answer:
      'Browse the course catalog, open any course you like, and click "Enroll for Free" or "Buy Now." Free courses give you instant access; paid courses go through a secure checkout first.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept card payments through Paystack. All prices are shown in Nigerian Naira (NGN).',
  },
  {
    question: 'Can I access my courses on mobile?',
    answer: 'Yes — Grammarcetamol works in any modern mobile browser, so you can learn from your phone, tablet, or computer.',
  },
  {
    question: 'Do I get a certificate after finishing a course?',
    answer: 'Certificates of completion are on our roadmap and will be available to all students once a course is fully completed.',
  },
  {
    question: 'What is your refund policy?',
    answer: 'If a course isn\'t right for you, reach out through Support within your first few days of purchase and we\'ll review your request.',
  },
  {
    question: 'Do I need any special software to take a course?',
    answer: 'No — everything runs in your web browser. A stable internet connection is all you need.',
  },
  {
    question: 'How do I track my learning progress?',
    answer: 'Your dashboard shows every course you\'re enrolled in, how far you\'ve gotten, and lets you pick up right where you left off.',
  },
  {
    question: 'Who are the instructors?',
    answer: 'Our courses are built and taught by experienced English language instructors focused on practical, real-world fluency.',
  },
];
