import {FaqAccordion} from '@/components/FaqAccordion';
import {FAQ_ITEMS} from '@/lib/faqData';

export default function FaqPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-text-primary text-center mb-2">Frequently Asked Questions</h1>
        <p className="text-text-secondary text-center mb-10">
          Everything you need to know about courses, payments, and learning on Grammarcetamol.
        </p>
        <FaqAccordion items={FAQ_ITEMS} />
      </div>
    </main>
  );
}
