import { LegalDocument } from '@/components/nele/LegalDocument';

export const TERMS_UPDATED = '18 November 2026';

export default function TermsScreen() {
  return (
    <LegalDocument
      title="Terms of use"
      updatedAt={TERMS_UPDATED}
      summary="Nele is a listing board that connects property owners and people looking in Raichur district. We are not a broker, we do not take payments, and we are not a party to any deal you make."
      sections={[
        {
          heading: '1. Who we are',
          body: [
            'Nele ("we", "us") operates the Nele mobile app, a marketplace where owners and agents list property in Raichur, Manvi, Sindhanur, Lingasgur and Mudgal.',
            'By creating an account or using the app you agree to these terms. If you do not agree, please do not use Nele.',
          ],
        },
        {
          heading: '2. Nele is only a listing service',
          body: [
            'We display listings published by other people. We do not own the properties, we do not verify title or ownership, and we do not negotiate, broker or guarantee any transaction.',
            'Any agreement you reach is between you and the other person. Verify ownership documents, measurements and approvals yourself before paying anyone.',
          ],
        },
        {
          heading: '3. No payments in the app',
          body: [
            'Payments and payouts are not enabled. Nele never asks for money inside the app and never collects card, UPI or bank details.',
            'If anyone asks you to send money "through Nele", it is a scam. Report it to us immediately.',
          ],
        },
        {
          heading: '4. Your account',
          body: [
            'You must be at least 18 years old and provide accurate details. You are responsible for activity under your account and for keeping your password private.',
            'You can delete your account at any time from Profile → Delete account. Deleting it removes your listings, photos, documents, messages and callback requests.',
          ],
        },
        {
          heading: '5. Listing rules',
          body: [
            'Only list property you own or are authorised to list. Prices, area and location must be accurate, and photos must show the property being listed.',
            'Do not post duplicate listings, fake prices to attract calls, other people\'s photos, or anything unlawful. We may remove any listing and suspend any account that breaks these rules.',
            'When a property is no longer available, mark it sold or delete it so people stop enquiring.',
          ],
        },
        {
          heading: '6. Photos and documents you upload',
          body: [
            'Photos you upload are visible to anyone using the app, so do not include people, number plates or documents in them if you do not want them seen.',
            'Documents (ownership proof, tax receipts, ID) are optional, stored privately, and visible only to you. Only upload documents you have the right to share.',
          ],
        },
        {
          heading: '7. Chat conduct',
          body: [
            'Chat exists so buyers and sellers can talk without sharing phone numbers. Messages are visible to the two people in the conversation and are stored so the conversation can be read later.',
            'No harassment, threats, spam, discriminatory abuse or attempts to move people into advance-fee fraud. We may review reported conversations and close accounts that abuse chat.',
          ],
        },
        {
          heading: '8. Booking agent requests',
          body: [
            'If you ask for a booking agent to contact you, you agree that we or an agent acting with us may call or message the phone number you provide, at the time you selected.',
            'We pass these details only to the person handling your request.',
          ],
        },
        {
          heading: '9. Content and liability',
          body: [
            'You keep ownership of what you upload and give us permission to display it inside the app for as long as your listing or account exists.',
            'To the extent the law allows, we are not liable for losses arising from deals between users, from listings being inaccurate, or from the app being unavailable. Nothing here limits rights you have under Indian consumer law.',
          ],
        },
        {
          heading: '10. Changes and governing law',
          body: [
            'We may update these terms as the app changes; the date above shows the current version, and continuing to use Nele means accepting it.',
            'These terms are governed by the laws of India, with courts in Karnataka having jurisdiction.',
          ],
        },
      ]}
      footer="Questions about these terms? Use Help centre → Contact us in the app, or email support@nele.app."
    />
  );
}
