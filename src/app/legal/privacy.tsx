import { LegalDocument } from '@/components/nele/LegalDocument';

export const PRIVACY_UPDATED = '18 November 2026';

export default function PrivacyScreen() {
  return (
    <LegalDocument
      title="Privacy policy"
      updatedAt={PRIVACY_UPDATED}
      summary="We collect what the app needs to show listings, connect you with people, and keep it safe. No advertising, no selling your data, no third-party tracking SDKs."
      sections={[
        {
          heading: '1. What we collect',
          body: [
            'Account: your name, email address and a password that is stored only as a hash by our authentication provider. Optional profile image.',
            'Listings: title, property type, town, locality, price, area, bedrooms, bathrooms, and the photos and documents you choose to attach.',
            'Chat: the messages you send in Nele, with the time and the account that sent them.',
            'Agent requests: your name, phone number, town, what you need, budget text and preferred contact time.',
            'Technical: the requests your app makes to our servers, kept in server logs for debugging and abuse prevention.',
          ],
        },
        {
          heading: '2. What we do NOT collect',
          body: [
            'No advertising identifiers, no third-party analytics or attribution SDKs, no contact-book access, no precise background location.',
            'Location is only used while you are choosing your district in the app, and you can skip it and pick your town manually.',
          ],
        },
        {
          heading: '3. Where your data lives',
          body: [
            'Nele runs on Neon (PostgreSQL, authentication, object storage and serverless functions) in the us-east-2 region. Data is stored on our behalf as a data processor and is not used by Neon for its own purposes.',
            'Photos are stored in a public bucket so listings load quickly for everyone. Documents and chat are stored in private storage and served only through short-lived signed links.',
          ],
        },
        {
          heading: '4. Who can see what',
          body: [
            'Public: your listing details, your listing photos, your display name, and whether a listing is active or sold.',
            'Only you: your documents, your email, your saved properties and your agent requests.',
            'Both participants: the messages in a conversation you are part of. Other users cannot read a conversation they are not in.',
            'Your phone number is never shown to other users. You only give it to us voluntarily in an agent request.',
          ],
        },
        {
          heading: '5. Why we use it',
          body: [
            'To show your listing to people browsing, to deliver chat messages between the right two people, to let an agent contact you when you ask for one, and to prevent spam and fraud.',
            'We do not profile you for advertising, and we do not sell or rent personal data to anyone.',
          ],
        },
        {
          heading: '6. How long we keep it',
          body: [
            'Listings, photos, documents, chat and agent requests are kept while your account exists, so your history stays available to you.',
            'When you delete your account, we delete your account record, listings, photos, documents, conversations, messages, saved properties and agent requests. Server logs age out on a short retention window.',
          ],
        },
        {
          heading: '7. Your choices and rights',
          body: [
            'Edit or delete any listing at any time. Delete individual photos or documents. Mark a property sold to hide it from public view.',
            'Delete your whole account from Profile → Delete account. This is immediate and irreversible.',
            'You can also request deletion without the app installed at nele.app/delete-account, or by emailing support@nele.app, and we will action it within 30 days.',
          ],
        },
        {
          heading: '8. Security',
          body: [
            'All traffic uses HTTPS. Authentication tokens are signed and verified on every request, and access to a listing, document or conversation is checked against your account on the server.',
            'No system is perfectly secure. Choose a unique password, and tell us if you think your account has been accessed by someone else.',
          ],
        },
        {
          heading: '9. Children',
          body: [
            'Nele is for adults doing property business. It is not intended for anyone under 18, and we do not knowingly collect data from children.',
          ],
        },
        {
          heading: '10. Changes and contact',
          body: [
            'If this policy changes we update the date above and, for significant changes, tell you in the app.',
            'Privacy questions or requests: support@nele.app.',
          ],
        },
      ]}
      footer="This policy describes the Nele app as of 18 November 2026. Payments and payouts are not enabled, so no payment data is collected."
    />
  );
}
