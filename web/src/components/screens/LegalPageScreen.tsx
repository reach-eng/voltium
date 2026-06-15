'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, Download, PenTool } from 'lucide-react';
import { useAppStore } from '@/store/app';
import { useRiderProfile } from '@/hooks/useRiderData';
import { BRAND_FULL, BRAND_SHORT, SUPPORT_EMAIL, SUPPORT_PHONE } from '@/lib/branding';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const fadeUp: any = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' },
  }),
};

const sections = [
  {
    id: 'terms',
    title: 'Terms of Service',
    content: `${BRAND_FULL} ("Company", "we", "us", or "our") operates the ${BRAND_SHORT} electric vehicle rental platform. By accessing or using our services, you agree to be bound by these Terms of Service.

1. SERVICE DESCRIPTION: ${BRAND_SHORT} provides electric vehicle rental services to registered riders. All vehicles remain the property of ${BRAND_SHORT} and are provided on a rental basis only.

2. ELIGIBILITY: You must be at least 18 years of age, hold a valid driving license, and have completed KYC verification to use our services.

3. RENTAL PERIOD: Rentals are offered on weekly, bi-weekly, and monthly plans. The rental period begins at vehicle pickup and ends upon return inspection.

4. USER RESPONSIBILITIES: Riders are responsible for the vehicle's safety, daily maintenance, and adherence to traffic regulations. Any damage caused by negligence will be charged to the rider.

5. PAYMENT: All payments must be made through the ${BRAND_SHORT} platform. Security deposits are refundable subject to vehicle condition at return.

6. TERMINATION: ${BRAND_SHORT} reserves the right to terminate rental agreements for violation of terms, non-payment, or misuse of vehicles.

7. LIABILITY: ${BRAND_SHORT}'s liability is limited to the rental value of the vehicle. We are not liable for indirect, incidental, or consequential damages.

8. GOVERNING LAW: These terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of courts in New Delhi.`,
  },
  {
    id: 'privacy',
    title: 'Privacy Policy',
    content: `${BRAND_SHORT} is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your personal information.

1. INFORMATION WE COLLECT: We collect personal identification information (name, phone, email, address, date of birth), government-issued IDs (Aadhaar, PAN), driving license details, bank account information for refunds, vehicle usage data, and GPS location data.

2. HOW WE USE YOUR DATA: Your data is used for identity verification and KYC compliance, rental agreement management, payment processing, customer support, safety and emergency services, and service improvement.

3. DATA SHARING: We may share your data with government authorities as required by law, our guarantor verification partners, payment processing banks, and insurance providers for claim processing.

4. DATA SECURITY: We implement industry-standard encryption, secure servers, and regular security audits. GPS data is encrypted and accessible only to authorized safety personnel.

5. DATA RETENTION: We retain your data for the duration of your account plus 7 years as required by Indian financial regulations.

6. YOUR RIGHTS: You have the right to access, correct, and delete your personal data. Requests can be submitted through the app or by contacting support.

7. COOKIES: We use essential cookies for app functionality and analytics cookies to improve our services. You can manage cookie preferences in app settings.`,
  },
  {
    id: 'refund',
    title: 'Refund Policy',
    content: `${BRAND_SHORT} maintains a transparent and fair refund policy:

1. SECURITY DEPOSIT: Fully refundable upon vehicle return in good condition. Processing time is 7-10 business days. Deductions may apply for vehicle damage, missing accessories, or outstanding dues.

2. PLAN CANCELLATION: If you cancel within 24 hours of plan activation, a full refund is issued. After 24 hours, no refund is available for the current billing period.

3. WALLET TOP-UP: Wallet balances are non-refundable but can be used for future transactions, plan renewals, or transferred to another ${BRAND_SHORT} rider.

4. PROMOTIONAL CREDITS: Reward credits and promotional amounts are non-refundable and have validity periods as specified at the time of issuance.

5. DISPUTE RESOLUTION: For refund disputes, contact support within 30 days of the transaction. Provide transaction ID and reason for dispute. Our team will investigate and respond within 5 business days.

6. FORCE MAJEURE: In case of service disruptions due to natural disasters, government orders, or other force majeure events, refunds will be processed on a pro-rata basis.

7. REFUND METHOD: All refunds are processed to the original payment method. Bank account refunds may take 7-10 business days to reflect.`,
  },
  {
    id: 'guarantor',
    title: "Guarantor's Agreement",
    content: `1. AGREEMENT: This Guarantor's Agreement ("Agreement") is made between ${BRAND_FULL} and the individual designated as the Guarantor for the Rider.

1. GUARANTEE: The Guarantor unconditionally and irrevocably guarantees the due and punctual payment of all rental fees, penalties, and damage costs incurred by the Rider.

2. LIABILITY: The Guarantor's liability is co-extensive with that of the Rider. In case of default by the Rider, the Company may proceed directly against the Guarantor without first exhausting remedies against the Rider.

3. VALIDITY: This guarantee remains valid for the entire duration of the Rider's association with ${BRAND_SHORT} and until all dues are cleared and the vehicle is returned in satisfactory condition.

4. DOCUMENTATION: The Guarantor agrees to provide valid identity proof, address proof, and a verification video as part of the onboarding process.

5. NOTIFICATIONS: The Guarantor consents to receive communications from ${BRAND_SHORT} regarding the Rider's account status, payments, and emergency situations.

6. INDEMNITY: The Guarantor agrees to indemnify ${BRAND_SHORT} against any losses, damages, or legal costs arising from the Rider's misuse of the vehicle or breach of contract.`,
  },
];

export default function LegalPageScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const showToast = useAppStore((s) => s.showToast);
  const { rider } = useRiderProfile();

  const handleDownload = (section: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const signatureUrl = section.id === 'guarantor' ? rider?.guarantorSignature : rider?.signature;
    const signerName =
      section.id === 'guarantor'
        ? rider?.guarantorName || 'Guarantor'
        : rider?.fullName || rider?.name || 'Rider';

    printWindow.document.write(`
      <html>
        <head>
          <title>${section.title} - ${signerName}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.6; }
            .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #0053c1; padding-bottom: 20px; }
            .branding { font-size: 24px; font-weight: 900; color: #0053c1; letter-spacing: 2px; }
            h1 { font-size: 20px; text-transform: uppercase; margin-top: 10px; }
            .content { font-size: 14px; white-space: pre-wrap; margin-bottom: 40px; text-align: justify; }
            .footer { margin-top: 60px; display: flex; justify-content: space-between; border-top: 1px solid #eee; pt-20 }
            .signature-box { text-align: center; width: 250px; }
            .sig-img { max-height: 80px; max-width: 200px; border-bottom: 1px solid #ccc; margin-bottom: 10px; }
            .label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #666; margin-bottom: 5px; }
            .signer { font-size: 14px; font-weight: bold; }
            .date { font-size: 12px; color: #666; margin-top: 5px; }
            @media print {
              .no-print { display: none; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="branding">${BRAND_FULL}</div>
            <h1>${section.title}</h1>
          </div>
          <div class="content">${section.content}</div>
          <div class="footer">
            <div class="signature-box">
              <div class="label">Accepted & Signed By</div>
              <div class="sig-container">
                ${signatureUrl ? `<img src="${signatureUrl}" class="sig-img" />` : '<div style="height:80px; border-bottom:1px solid #ccc; margin-bottom:10px;"></div>'}
              </div>
              <div class="signer">${signerName}</div>
              <div class="date">${currentDate}</div>
            </div>
            <div class="signature-box" style="text-align: right;">
              <div class="label">For ${BRAND_FULL}</div>
              <div style="height:80px; display:flex; align-items:flex-end; justify-content:flex-end; border-bottom:1px solid #ccc; margin-bottom:10px;">
                <img src="/logo.svg" style="height:40px; opacity:0.5;" />
              </div>
              <div class="signer">Authorized Signatory</div>
            </div>
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                // Optional: window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const currentDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-vf-surface mesh-gradient pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button
          onClick={() => setScreen('profile')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
        >
          <ArrowLeft size={18} className="text-vf-on-surface" />
        </button>
        <h1 className="text-xl font-bold text-vf-on-surface">Legal</h1>
      </div>

      <div className="px-5">
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-xl bg-white shadow-[0px_24px_48px_rgba(15,23,42,0.04)] overflow-hidden"
        >
          <Accordion type="multiple" className="w-full">
            {sections.map((section, idx) => {
              const isGuarantorDoc = section.id === 'guarantor';
              const signerName = (
                isGuarantorDoc
                  ? rider?.guarantorName || 'Guarantor'
                  : rider?.fullName || rider?.name || 'Rider'
              ) as string;
              const signatureUrl = isGuarantorDoc ? rider?.guarantorSignature : rider?.signature;
              const photoUrl = (isGuarantorDoc ? rider?.guarantorPhoto : rider?.profilePhoto) as
                | string
                | undefined;

              return (
                <AccordionItem
                  key={section.id}
                  value={section.id}
                  className="border-b border-vf-surface-container-low last:border-b-0"
                >
                  <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-vf-surface-container-low/50 transition-colors">
                    <span className="text-sm font-bold text-vf-on-surface">{section.title}</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-4">
                    <div className="text-xs text-vf-on-surface-variant leading-relaxed whitespace-pre-line max-h-96 overflow-y-auto no-scrollbar">
                      {section.content}
                    </div>

                    <div className="mt-6 pt-6 border-t border-vf-surface-container-low">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-vf-surface-container-low/50">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#0053c1] flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {String(signerName)[0]}
                            </div>
                            <div>
                              <p className="text-[10px] text-vf-on-surface-variant uppercase font-bold tracking-wider">
                                Signed By
                              </p>
                              <p className="text-xs font-bold text-vf-on-surface">{signerName}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-vf-on-surface-variant uppercase font-bold tracking-wider">
                              Date
                            </p>
                            <p className="text-xs font-bold text-vf-on-surface">{currentDate}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-xl border border-dashed border-vf-outline-variant bg-white min-h-[80px]">
                          <div className="flex items-center gap-3 flex-1">
                            {signatureUrl ? (
                              <img
                                src={signatureUrl as string}
                                alt="Signature"
                                className="h-10 object-contain opacity-80"
                              />
                            ) : (
                              <div className="flex items-center gap-3">
                                <PenTool size={16} className="text-[#0053c1]" />
                                <span className="text-xs font-medium text-vf-on-surface italic font-serif opacity-50">
                                  {signerName} (Electronic Signature)
                                </span>
                              </div>
                            )}
                          </div>
                          {photoUrl && (
                            <div className="h-12 w-12 rounded-lg bg-vf-surface-container-low flex items-center justify-center overflow-hidden border border-vf-surface-container-low shrink-0 shadow-sm ml-4">
                              <img
                                src={photoUrl as string}
                                alt="Signer"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => handleDownload(section)}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0053c1] py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/10 transition-transform active:scale-[0.98]"
                        >
                          <Download size={16} />
                          Download Signed PDF
                        </button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </motion.div>

        {/* Contact Info */}
        <motion.div
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="mt-5 rounded-xl bg-vf-surface-container-low p-4"
        >
          <p className="text-xs font-bold text-vf-on-surface-variant uppercase tracking-wider mb-2">
            Need Help?
          </p>
          <p className="text-xs text-vf-on-surface-variant leading-relaxed">
            If you have any questions about our policies, please contact our support team at{' '}
            <span className="font-semibold text-[#0053c1]">{SUPPORT_EMAIL}</span> or call{' '}
            <span className="font-semibold text-[#0053c1]">{SUPPORT_PHONE}</span>.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
