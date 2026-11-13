/* =====================================================================
   BRAND — company details, the same for every package.
   Edit once; every brochure picks it up.
   ===================================================================== */
window.BRAND = {
  name: "Your Travel Co.",
  shortLogoText: "YT",            // shown in the round badge if the logo file is missing
  logo: "assets/brand/logo.png",
  tagline: "A SOCIAL TRAVEL COMMUNITY",
  footerSlogan: "TRAVELER FOR LIFE",
  address: "Office address line 1<br>City, State PIN",
  website: "yourwebsite.com",
  phones: ["+91 00000 00000", "+91 00000 00000"],
  email: "contact@yourwebsite.com",
  rating: "4.9",
  reviewsCount: "1,000+",
  socials: ["f", "ig", "X", "wa", "web", "yt"],
  awards: ["Award / Recognition 1", "Award / Recognition 2", "Award / Recognition 3", "Award / Recognition 4", "Award / Recognition 5"],
  whyUs: [
    { t: "Trip Captains", d: "Experienced leads on every departure" },
    { t: "Curated Stays", d: "Hand-picked hotels & homestays" },
    { t: "Safety First", d: "Oxygen, first aid & mechanical support" }
  ],
  bank: {
    accountName: "Your Company Pvt Ltd",
    bankName: "Bank Name",
    accountNo: "000000000000",
    ifsc: "XXXX0000000",
    upi: "yourupi@bank"
  },
  gateway: "Razorpay",
  qrImage: "assets/brand/qr.png",
  emiText: "No Cost EMIs available",
  payment: {
    cols: ["Upto 30 Days", "29–21 Days", "20–15 Days", "14–7 Days"],
    rows: [
      { label: "BOOKING<br>AMOUNT", cells: ["COMP", "OK", "OK", "OK"] },
      { label: "<big>50%</big>PAYMENT", cells: ["Optional", "COMP", "NO", "NO"] },
      { label: "<big>75%</big>PAYMENT", cells: ["Optional", "Optional", "COMP", "NO"] },
      { label: "<big>FULL</big>PAYMENT", cells: ["Optional", "Optional", "Optional", "COMP"] }
    ]
  },
  cancellation: {
    cols: ["Upto 30 Days", "29–21 Days", "20–15 Days", "14–0 Days"],
    rows: [
      { label: "BATCH<br>SHIFTING", cells: ["OK", "NO", "NO", "NO"] },
      { label: "CANCELLATION<br>CHARGE", cells: ["Free Cancellation", "25% of the Trip Amount", "50% of the Trip Amount", "RED:100% of the Trip Amount"] },
      { label: "BOOKING<br>AMOUNT", cells: ["Refunded as Credit Note", "Adjusted in Refund Deduction", "Adjusted in Refund Deduction", "RED:No Refund"] },
      { label: "REMAINING<br>AMOUNT", cells: ["Full Refund (minus) Booking Amount", "Refund (minus) 25% of Trip Amount", "Refund (minus) 50% of Trip Amount", "RED:No Refund"] }
    ]
  },
  reviews: [
    { name: "Traveler Name", text: "Add a real review from Google here. Keep it 3–5 lines so the card stays balanced." },
    { name: "Traveler Name", text: "Add a real review from Google here. Keep it 3–5 lines so the card stays balanced." },
    { name: "Traveler Name", text: "Add a real review from Google here. Keep it 3–5 lines so the card stays balanced." },
    { name: "Traveler Name", text: "Add a real review from Google here. Keep it 3–5 lines so the card stays balanced." }
  ]
};
