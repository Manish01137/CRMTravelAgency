/* =====================================================================
   PACKAGE — Winter Spiti. Copy this file to make a new trip:
   packages/<slug>.js, images in assets/<slug>/, then add the slug to
   packages/list.js.
   Text: **word** = blue bold highlight, __word__ = bold italic (notes).
   ===================================================================== */
window.PACKAGE = {
  slug: "winter-spiti",
  title: "Winter Spiti",           // big gold cover title
  route: "Delhi to Delhi",
  duration: "8N/9D",
  scriptLine: "A Winter Journey to", // brown script above the big name (About page)
  scriptTitle: "Spiti Valley",       // big blue script title (About page)
  via: "VIA SHIMLA",
  coverImage: "assets/winter-spiti/cover.jpg",
  tocImage: "assets/winter-spiti/toc.jpg",
  intro: [
    "Imagine a valley where snow hushes everything and the mountains wear white all season. That is Spiti in winter — quiet, raw and unforgettable.",
    "Over 9 days we take the only winter-open route into Spiti, climbing from **Shimla** through **Kinnaur** into a cold desert of frozen rivers, ancient monasteries and star-filled skies above **Chitkul**, **Kalpa** and **Nako**.",
    "**Kaza** is our base, but the magic lies in the villages around it — **Hikkim** with the world's highest post office, **Komic**, fossil-rich **Langza**, and monasteries like **Key**, **Tabo** and **Dhankar**.",
    "We take care of stays, transport, permits and a Trip Captain on ground — you just enjoy the journey."
  ],
  // 5 photos; the first one spans the full width
  gallery: [1, 2, 3, 4, 5].map((n) => `assets/winter-spiti/gallery-${n}.jpg`),
  briefImages: [1, 2, 3].map((n) => `assets/winter-spiti/brief-${n}.jpg`),
  days: [
    { day: 1, title: "Delhi to Shimla | Overnight Journey", brief: "**Delhi** to **Shimla** | Overnight Journey", km: "", image: "assets/winter-spiti/day-1.jpg",
      points: ["The group assembles at the pick-up point by 10:00 PM (tentative).",
               "We'll meet the team captains and a short tour briefing will be conducted.",
               "Afterward, we'll head out on an overnight journey to **Shimla**."],
      notes: ["The pickup point would be __Kashmere Gate__ (tentative)"] },
    { day: 2, title: "Shimla to Chitkul/Sangla", km: "225 Kms", image: "assets/winter-spiti/day-2.jpg",
      points: ["Early in the morning, we'll arrive in **Shimla** via the Hindustan-Tibet highway.",
               "We'll switch from bus to Tempo Traveller here and head out for **Chitkul/Sangla**.",
               "Upon reaching **Chitkul/Sangla**, we'll check into our hotels.",
               "Later, we'll enjoy group bonding activities. Dinner followed by an overnight stay in Chitkul/Sangla."],
      notes: ["We'll stay in Sangla if harsh weather doesn't allow a stay in Chitkul.",
              "The freshen-up point will be 2 hours ahead of Shimla.",
              "Standard Check-in time is 01:00 PM.",
              "__Highlight of the Day:__ Chitkul, Sangla."] },
    { day: 3, title: "Chitkul/Sangla to Kalpa", km: "60 Kms", image: "assets/winter-spiti/day-3.jpg",
      points: ["After breakfast, head towards **Kalpa** with sightseeing at **Chitkul**, the last inhabited village in the **Baspa Valley**.",
               "On the way, we'll explore **Reckong Peo**, with views of the **Kinner Kailash** peak.",
               "We'll also visit **Kamru Fort** en-route if time permits.",
               "Upon reaching **Kalpa**, we'll visit the **Kalpa Monastery** and the **Suicide Point** viewpoint.",
               "Dinner followed by an overnight stay in **Kalpa**."],
      notes: ["__Highlight of the Day:__ Reckong Peo, Kamru Fort, Kalpa Monastery."] },
    { day: 4, title: "Kalpa to Nako", km: "100 Kms", image: "assets/winter-spiti/day-4.jpg",
      points: ["After breakfast, we'll continue towards **Nako**, a tiny hamlet in the trans-Himalayan ranges.",
               "En route, we'll stop at **Khab**, the confluence of the Sutlej and Spiti rivers.",
               "In Nako, we'll visit **Nako Lake** and the **Nako Monastery**.",
               "Dinner and overnight stay at Nako."],
      notes: ["Common washrooms with one bucket of hot water will be provided here due to altitude and temperature. (Only during extreme winter months)",
              "__Highlight of the Day:__ Khab, Nako Lake, Nako Monastery."] },
    { day: 5, title: "Nako to Kaza", km: "110 Kms", image: "assets/winter-spiti/day-5.jpg",
      points: ["Post breakfast, we head to **Kaza**, the headquarters of Spiti.",
               "En route, we visit the thousand-year-old **Tabo Monastery**, then **Dhankar Monastery** and **Dhankar Fort**.",
               "We'll reach **Kaza** before evening and check in. The rest of the day is at leisure.",
               "Dinner followed by an overnight stay at Kaza."],
      notes: ["Common washrooms with one bucket of hot water will be provided here. (Only during extreme winter months)",
              "__Highlight of the Day:__ Tabo Monastery, Dhankar Monastery, Dhankar Fort."] },
    { day: 6, title: "Spiti Sightseeing Day", brief: "**Spiti Sightseeing Day**", km: "Komic, Hikkim, Langza, Key, Chicham", kmSmall: true, image: "assets/winter-spiti/day-6.jpg",
      points: ["Post breakfast, we visit **Key Monastery**, followed by **Chicham Bridge**, Asia's highest bridge.",
               "Next, the world's highest post office at **Hikkim**, then **Komic village**, one of the highest motorable villages.",
               "We finish at **Langza**, the land of fossils, with its Buddha statue overlooking the village.",
               "Back to **Kaza** for dinner and overnight stay."],
      notes: ["__Highlight of the Day:__ Key Monastery, Chicham Bridge, Hikkim, Komic, Langza."] },
    { day: 7, title: "Kaza to Kalpa", km: "200 Kms", image: "assets/winter-spiti/day-7.jpg",
      points: ["After breakfast, we start our return journey to **Kalpa**.",
               "If time permits, we'll visit **Lingti Falls**, a frozen waterfall.",
               "We'll reach Kalpa by evening for dinner and an overnight stay."],
      notes: ["__Highlight of the Day:__ Lingti Falls."] },
    { day: 8, title: "Kalpa to Shimla", km: "222 Kms", image: "assets/winter-spiti/day-8.jpg",
      points: ["After breakfast, we drive back towards **Shimla**.",
               "En route, a photo stop at **Rock Tunnel**, the gateway to Kinnaur.",
               "On reaching **Shimla**, we board the overnight bus to **Delhi**."],
      notes: ["Standard Check-out time is 11:00 AM.", "__Highlight of the Day:__ Rock Tunnel."] },
    { day: 9, title: "Delhi Arrival | Tour Ends", brief: "**Delhi** Arrival | Tour Ends", km: "", image: "assets/winter-spiti/day-9.jpg",
      points: ["We'll reach **Delhi** early in the morning and the group will disperse with fond memories.",
               "End of the **Winter Spiti** Road Trip."],
      notes: ["Book your return flight for this day after consulting your Trip Coordinator."] }
  ],
  batches: [
    { from: "02 Oct", to: "10 Oct" }, { from: "10 Oct", to: "18 Oct" }, { from: "17 Oct", to: "25 Oct" },
    { from: "24 Oct", to: "01 Nov" }, { from: "31 Oct", to: "08 Nov" }, { from: "07 Nov", to: "15 Nov" },
    { from: "14 Nov", to: "22 Nov" }, { from: "21 Nov", to: "29 Nov" }, { from: "28 Nov", to: "06 Dec" },
    { from: "05 Dec", to: "13 Dec" }, { from: "12 Dec", to: "20 Dec" }, { from: "27 Feb", to: "07 Mar" },
    { from: "06 Mar", to: "14 Mar" }, { from: "13 Mar", to: "21 Mar" }, { from: "20 Mar", to: "28 Mar" },
    { from: "26 Mar", to: "03 Apr" }, { from: "03 Apr", to: "11 Apr" }, { from: "10 Apr", to: "18 Apr" }
    // add  full: true  to a batch to show SOLD OUT
  ],
  inclusions: [
    "AC Volvo Bus from Delhi to Shimla and return",
    "Tempo Traveller from Shimla to Shimla",
    "Accommodations on sharing basis as per itinerary",
    "**Meal Plan:** MAP Plan (Total 12 Meals — Breakfast + Dinner from Day 2 to Day 8)",
    "Evening Tea/Coffee on Day 2, 3, 5, 6 and 7",
    "Freshen-up rooms 2 hours ahead of Shimla",
    "An experienced Trip Lead present at all times during the tour",
    "Mechanical Support", "All Required Permits", "**Adventure Medical Insurance**",
    "First Aid Kits", "Oxygen Cylinders", "Oximeter"
  ],
  exclusions: [
    "5% GST",
    "Early check-in (Before 1:00 PM) & Late Check-out (After 11:00 AM) at the hotel",
    "Any additional expenses of personal nature",
    "Additional accommodation/food costs incurred due to any travel delay",
    "Any lunch and other meals not mentioned in Package Inclusions",
    "Any Airfare / Rail fare other than what is mentioned in “Inclusions” or any type of transportation",
    "Parking and monument entry fees during sightseeing",
    "Additional costs due to flight cancellations, landslides, roadblocks and other natural calamities",
    "Any other services not specified above in inclusions"
  ],
  costing: {
    saleTag: "SALE IS LIVE",       // "" to hide
    route: "Delhi to Delhi",
    options: [
      { label: "Triple Occupancy", price: "22,500", oldPrice: "24,000" },
      { label: "Double Occupancy", price: "23,500", oldPrice: "25,500" }
    ],
    gstNote: "+ 5% GST per person",
    notes: [
      "Triple Sharing rooms have one double bed and one ground mattress, and 3 people share one room.",
      "Double Sharing rooms have one double bed (no twin beds), and 2 people share one room."
    ],
    bookingAmount: "5,000",
    bookingLink: "#"
  },
  carry: {
    "Documents": ["Valid Government ID Proof"],
    "Gears": ["A rucksack of 50–60 L", "A small day backpack", "Refillable water bottle"],
    "Clothing": ["4 sun caps", "Woolen cap", "2 fleece jackets", "2 winter jackets (down jacket preferred)", "Thermal inners (top & bottom)", "UV-protected sunglasses", "Waterproof shoes with good grip", "Woolen socks & gloves"],
    "Medications": ["Glucose powder", "Tablets for headache, diarrhea, altitude sickness", "Cold & cough tablets", "Band-aids & crepe bandage", "Any personal medication advised by your doctor"],
    "Personal Accessories": ["Toothbrush & toothpaste", "Sunscreen (SPF 50+)", "Lip balm & cold cream", "Power bank", "Torch / head-lamp", "Wet wipes & tissues"]
  },
  handbook: [
    { h: "Tour Program Trip Operations", items: [
      "Please stick to the shared tour program. If you leave early or join midway, no refunds will be provided for unused services.",
      "Changes to the itinerary due to weather, roadblocks or safety will be decided by the Trip Captain.",
      "Extra costs from such changes (stays, food, transport) are to be borne by travelers."] },
    { h: "Transport & Logistics", items: [
      "Fixed bus services (Delhi to base and return) are pre-arranged for your convenience.",
      "Be on time for pick-ups; delays affect the whole group."] },
    { h: "Respecting the Journey", items: [
      "Respect nature, local communities and the trails we walk.",
      "Follow travelers' comfort and personal space."] },
    { h: "Accommodation & Room Sharing", items: [
      "For triple-sharing stays, an extra mattress is provided on the floor.",
      "Facilities in remote stays may be basic — embrace the experience."] },
    { h: "Environmental Awareness", items: [
      "Carry a reusable bottle — avoid single-use plastic.",
      "Follow the leave-no-trace principle and dispose of waste responsibly."] },
    { h: "Group Code of Conduct", items: [
      "**Stick Together:** We travel as a group, please don't wander off alone.",
      "**Be Punctual:** Keep to the schedule shared by the Trip Captain.",
      "**No Alcohol / Smoking:** Not allowed during travel in vehicles.",
      "**Safety Matters:** If you see someone struggling, offer help."] }
  ],
  closingLine: "See You on the Mountains!"
};
