/**
 * The Adventure brochure's stylesheet — the agency-supplied 1080×1350 template's
 * CSS, unchanged except that every rule is scoped under `.advb` (so its generic
 * class names like .page / .cover never touch the rest of the app) and a few
 * fit helpers at the end.
 */
export const ADVENTURE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Poppins:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500&family=Yellowtail&family=Cinzel:wght@700;900&family=Montserrat:wght@700;800;900&display=swap';
export const ADVENTURE_FONT_FAMILIES = ['Oswald', 'Poppins', 'Yellowtail', 'Cinzel', 'Montserrat'];

const RAW = `
:root{
  --blue:#0b5cb5; --blue-dark:#08458c; --blue-deep:#06306a; --sky:#2f8fe0;
  --yellow:#ffd21f; --yellow-2:#ffe45c; --orange:#f26a1b; --red:#e23b3b; --green:#2fb44a;
  --ink:#1c1c1c; --muted:#4a4a4a;
  --brown:#6b3a10;
  --pw:1080px; --ph:1350px;
  font-family:'Poppins',sans-serif;color:var(--ink);
}
*{box-sizing:border-box;margin:0;padding:0}
.page{width:var(--pw);height:var(--ph);position:relative;overflow:hidden;background:#fff;flex:none}
b.hl{color:var(--blue);font-weight:600}
.bg-sky{background:linear-gradient(180deg,#3d9be9 0%,#8cc8f2 14%,#e8f4fb 34%,#f6fbef 62%,#e4f3c4 100%)}
.bg-paper{background:radial-gradient(ellipse at 30% 20%,#ffffff 0%,#f1f1ef 60%,#e6e6e3 100%)}
.bg-light{background:linear-gradient(160deg,#fdfdf6 0%,#f4f9e6 45%,#e6f3d6 100%)}
.bg-blue{background:radial-gradient(circle at 80% 15%,rgba(255,255,255,.12) 0 120px,transparent 121px),linear-gradient(170deg,#1b6fd6 0%,#0f5fc4 40%,#118b8f 78%,#2fbf4e 100%)}
.mountains{position:absolute;left:0;right:0;bottom:0;height:420px;pointer-events:none;opacity:.55}
.logo-badge{position:absolute;top:34px;right:40px;width:62px;height:62px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;font-family:'Montserrat',Arial,sans-serif;font-weight:900;font-size:20px;color:var(--sky);overflow:hidden;z-index:5}
.logo-badge img{width:100%;height:100%;object-fit:contain}
.ph-img{background:linear-gradient(180deg,#7fb6e6 0%,#bfdcf3 45%,#ffffff 46%,#e9eef3 60%,#9fb0bf 100%);position:relative}
.ph-img img{width:100%;height:100%;object-fit:cover;display:block}
.cover .photo{position:absolute;inset:0}
.cover .shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,40,90,.55) 0%,rgba(0,0,0,0) 35%,rgba(0,0,0,0) 60%,rgba(0,0,0,.35) 100%)}
.cover .flags{position:absolute;top:0;left:0;right:0;height:90px;display:flex;justify-content:space-around}
.cover .flags span{width:70px;height:80px;clip-path:polygon(0 0,100% 0,85% 100%,10% 90%);opacity:.9}
.cover .title-wrap{position:absolute;top:150px;left:0;right:0;text-align:center;color:#fff}
.cover .route{font-family:'Montserrat',Arial,sans-serif;font-weight:800;font-size:30px;letter-spacing:1px;display:inline-flex;align-items:center;gap:14px}
.cover .route::after{content:"";width:120px;height:2px;background:#fff}
.cover h1{font-family:'Cinzel',serif;font-weight:900;font-size:118px;line-height:1;background:linear-gradient(180deg,#fff6c9 0%,#ffd75a 45%,#e7a91c 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 4px 6px rgba(0,0,0,.45));margin-top:6px}
.cover .dur{display:inline-block;margin-top:10px;margin-left:520px;background:var(--blue);color:#fff;font-family:'Montserrat',Arial,sans-serif;font-weight:800;font-size:22px;padding:4px 18px;border-radius:20px}
.cover .socials{position:absolute;bottom:150px;left:0;right:0;display:flex;justify-content:center;gap:22px}
.cover .socials span{width:56px;height:56px;border-radius:12px;background:var(--blue);border:3px solid #fff;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;box-shadow:0 3px 8px rgba(0,0,0,.35)}
.cover .awards{position:absolute;bottom:22px;left:50px;right:50px;height:92px;background:#fff;border-radius:14px;display:flex;align-items:center;justify-content:space-around;padding:0 20px;box-shadow:0 4px 12px rgba(0,0,0,.3)}
.cover .awards .lbl{position:absolute;top:-16px;left:50%;transform:translateX(-50%);background:#fff;padding:3px 18px;border-radius:10px;font-size:13px;font-weight:700;letter-spacing:2px;color:var(--blue)}
.cover .awards .a{font-family:'Montserrat',Arial,sans-serif;font-weight:800;font-size:15px;color:#333;text-align:center;max-width:140px}
.toc .side{position:absolute;left:0;top:0;bottom:0;width:470px}
.toc .side .ph-img{position:absolute;inset:0}
.toc .panel{position:absolute;right:60px;top:0;bottom:120px;width:480px;background:#fff;box-shadow:0 0 0 1px #eee, -10px 0 25px rgba(0,0,0,.15);padding:50px 50px}
.toc h2{font-family:'Oswald','Arial Narrow',Impact,sans-serif;color:var(--blue);line-height:.95}
.toc h2 small{display:block;font-size:40px}
.toc h2 span{font-size:72px;color:var(--blue)}
.toc ol{list-style:none;margin-top:40px}
.toc li{display:flex;align-items:center;gap:24px;font-size:22px;margin-bottom:20px}
.toc li i{font-family:'Yellowtail','Brush Script MT',cursive;font-style:normal;color:var(--blue);font-size:40px;width:36px;text-align:right}
.about{padding:60px 70px 0}
.about .script{font-family:'Yellowtail','Brush Script MT',cursive;color:var(--brown);font-size:56px;text-align:center;margin-left:80px;line-height:1}
.about .big{font-family:'Yellowtail','Brush Script MT',cursive;color:var(--blue-deep);font-size:130px;text-align:center;line-height:.9;margin-top:-6px}
.about .via{text-align:center;font-family:'Montserrat',Arial,sans-serif;font-weight:800;color:var(--brown);font-size:24px;margin-top:-6px}
.about p{font-size:19.5px;line-height:1.38;text-align:justify;margin-top:16px;color:#222}
.about .why{text-align:center;margin-top:36px;font-family:'Oswald','Arial Narrow',Impact,sans-serif;font-size:50px;color:var(--brown);text-transform:uppercase}
.about .why span{font-family:'Montserrat',Arial,sans-serif;text-transform:none;color:var(--sky);font-size:60px;font-weight:800}
.about .why-box{margin:26px auto 0;width:900px;background:#fff;border-radius:22px;box-shadow:0 4px 18px rgba(0,0,0,.12);padding:26px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.about .why-box div{border:2px solid #e3eefb;border-radius:14px;padding:16px;text-align:center}
.about .why-box b{display:block;font-family:'Oswald','Arial Narrow',Impact,sans-serif;color:var(--blue);font-size:26px}
.about .why-box small{font-size:15px;color:#444}
.about .ratings{position:absolute;bottom:34px;left:0;right:0;display:flex;justify-content:center;gap:20px}
.about .ratings span{background:#3a4a2a;color:#fff;border-radius:22px;padding:8px 22px;font-weight:600;font-size:18px}
.about .ratings span em{font-style:normal;color:var(--yellow)}
.gallery{padding:60px 50px;display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:1fr;gap:28px;height:100%}
.gallery .ph-img{border:10px solid #fff;box-shadow:0 6px 16px rgba(0,0,0,.25)}
.gallery .ph-img:nth-child(odd){transform:rotate(-1.5deg)}
.gallery .ph-img:nth-child(even){transform:rotate(1.5deg)}
.gallery .wide{grid-column:span 2}
.brief{padding:56px 70px}
.brief h2{font-family:'Oswald','Arial Narrow',Impact,sans-serif;font-size:76px;color:var(--blue-dark);text-align:center;line-height:1}
.brief .sub{text-align:center;color:var(--red);font-weight:700;font-size:22px}
.brief .rows{margin-top:40px;width:560px}
.brief .row{margin-bottom:22px}
.brief .row .d{display:inline-block;font-family:'Oswald','Arial Narrow',Impact,sans-serif;font-size:17px;color:var(--blue-dark);border:2px solid var(--blue-dark);border-radius:4px;padding:0 8px;line-height:22px;background:#fff}
.brief .row .t{font-size:24px;font-weight:600;margin-top:3px}
.brief .row .t .r{color:var(--red)}
.brief .row .t small{font-size:15px;color:var(--orange);font-weight:600}
.brief .row .t .sub2{display:block;font-size:15px;color:var(--blue);font-weight:500}
.brief .polaroids{position:absolute;right:60px;top:210px;width:340px;display:flex;flex-direction:column;gap:30px}
.brief .polaroids .ph-img{height:240px;border:9px solid #fff;box-shadow:0 5px 14px rgba(0,0,0,.25)}
.brief .polaroids .ph-img:nth-child(1){transform:rotate(3deg)}
.brief .polaroids .ph-img:nth-child(2){transform:rotate(-3deg)}
.brief .polaroids .ph-img:nth-child(3){transform:rotate(2deg)}
.dayp .head{font-family:'Oswald','Arial Narrow',Impact,sans-serif;font-size:58px;color:var(--yellow);text-align:center;padding-top:36px;text-shadow:0 3px 0 var(--blue-deep),0 0 12px rgba(0,0,0,.2)}
.dayp .photo{position:absolute;left:70px;right:70px;height:560px;background:#fff;padding:16px;box-shadow:0 8px 20px rgba(0,0,0,.25);transform:rotate(-.6deg);clip-path:polygon(0 1%,4% 0,9% 1.2%,15% .2%,22% 1%,30% 0,38% 1.3%,46% .3%,55% 1%,63% 0,72% 1.2%,80% .2%,88% 1%,95% 0,100% 1%,99.4% 10%,100% 22%,99.3% 35%,100% 48%,99.4% 61%,100% 74%,99.3% 87%,100% 99%,94% 100%,86% 98.8%,78% 100%,70% 99%,61% 100%,52% 98.9%,43% 100%,35% 99%,26% 100%,18% 98.8%,10% 100%,3% 99%,0 100%,.6% 88%,0 75%,.7% 62%,0 49%,.6% 36%,0 23%,.7% 11%)}
.dayp .photo .ph-img{width:100%;height:100%}
.dayp .bar{position:absolute;left:44px;display:flex;align-items:center;gap:0;height:66px}
.dayp .bar .dn{background:var(--yellow);color:var(--blue-deep);font-family:'Oswald','Arial Narrow',Impact,sans-serif;font-weight:600;font-size:40px;padding:0 16px;height:66px;display:flex;align-items:center;border-radius:12px 0 0 12px;position:relative;z-index:2}
.dayp .bar .dn::after{content:"";position:absolute;right:-18px;top:0;border-left:18px solid var(--yellow);border-top:33px solid transparent;border-bottom:33px solid transparent}
.dayp .bar .tt{background:linear-gradient(90deg,var(--blue-dark),var(--sky));color:#fff;font-family:'Oswald','Arial Narrow',Impact,sans-serif;font-weight:600;font-size:38px;height:58px;display:flex;align-items:center;padding:0 40px 0 34px;margin-left:-2px;clip-path:polygon(0 0,100% 0,97% 100%,0 100%)}
.dayp .bar .km{margin-left:14px;background:var(--yellow);border:2px solid #e2a800;color:#222;font-weight:700;font-size:22px;padding:2px 14px;border-radius:8px}
.dayp .bar .km.small{font-size:16px;font-weight:600}
.dayp ul.pts{position:absolute;left:62px;right:62px;list-style:none}
.dayp ul.pts li{font-size:21px;line-height:1.35;margin-bottom:10px;padding-left:34px;position:relative;text-align:justify}
.dayp ul.pts li::before,.note-list li::before{content:"»";position:absolute;left:0;top:-6px;font-size:34px;color:var(--blue-dark);font-weight:700}
.dayp .note{position:absolute;left:50px;right:60px;bottom:120px;display:flex;align-items:flex-start;gap:16px}
.dayp .note .tag{flex:none;background:var(--blue);color:#fff;font-family:'Oswald','Arial Narrow',Impact,sans-serif;font-size:24px;padding:2px 16px 2px 12px;border-radius:10px;display:flex;align-items:center;gap:8px;box-shadow:0 2px 0 var(--blue-deep)}
.dayp .note .tag::before{content:"";width:18px;height:20px;background:var(--yellow);border-radius:3px;clip-path:polygon(0 0,100% 0,100% 70%,70% 100%,0 100%)}
.note-list{list-style:none}
.note-list li{font-style:italic;font-size:18.5px;line-height:1.3;padding-left:28px;position:relative;color:#222}
.note-list li::before{font-style:normal;font-size:26px;top:-5px}
.note-list li i.b{font-weight:700;font-style:italic;color:var(--blue-deep)}
.reviews{padding:50px 50px}
.reviews h2{font-family:'Yellowtail','Brush Script MT',cursive;font-size:110px;color:var(--blue-dark);line-height:1;margin-left:120px}
.reviews .sub{font-family:'Montserrat',Arial,sans-serif;font-weight:800;letter-spacing:3px;color:var(--orange);font-size:24px;margin-left:200px}
.reviews .grid{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:30px}
.reviews .card{background:#fff;border-radius:14px;box-shadow:0 3px 14px rgba(0,0,0,.12);padding:20px 22px}
.reviews .card .who{display:flex;gap:12px;align-items:center}
.reviews .card .av{width:48px;height:48px;border-radius:50%;background:var(--sky);color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;overflow:hidden}
.reviews .card .av img{width:100%;height:100%;object-fit:cover}
.reviews .card .nm{font-weight:600;font-size:17px}
.reviews .card .st{color:#f6b400;font-size:16px}
.reviews .card p{font-size:15.5px;line-height:1.4;margin-top:10px;color:#333}
.batches{padding-top:70px}
.batches h2{font-family:'Oswald','Arial Narrow',Impact,sans-serif;font-size:80px;color:var(--blue-dark);text-align:center;line-height:1}
.batches .sub{text-align:center;font-family:'Montserrat',Arial,sans-serif;font-weight:800;color:var(--blue-dark);font-size:26px;margin-top:6px}
.batches .list{margin:26px 34px 0;display:flex;flex-direction:column;gap:6px}
.batches .b{display:flex;height:62px;background:linear-gradient(180deg,#1a6fd0,#0b55ab);border:2px solid #0a4a96;border-radius:6px;box-shadow:0 2px 0 rgba(0,0,0,.2)}
.batches .b .n{width:220px;border-right:3px solid #fff;color:#fff;font-family:'Oswald','Arial Narrow',Impact,sans-serif;font-style:italic;font-weight:600;font-size:34px;display:flex;align-items:center;justify-content:center}
.batches .b .dt{flex:1;color:var(--yellow);font-weight:600;font-size:28px;display:flex;align-items:center;justify-content:center}
.batches .b .dt sup{font-size:16px}
.batches .b.full{opacity:.55}
.batches .b.full .dt::after{content:"SOLD OUT";margin-left:14px;font-size:14px;background:var(--red);color:#fff;padding:2px 8px;border-radius:4px}
.incl{padding:80px 80px}
.incl h2{text-align:center;font-family:'Oswald','Arial Narrow',Impact,sans-serif;font-size:56px;line-height:1}
.incl h2 span{background:linear-gradient(180deg,transparent 45%,var(--yellow-2) 45%,var(--yellow-2) 92%,transparent 92%);padding:0 6px}
.incl.in h2{color:var(--green)}
.incl.ex h2{color:var(--brown)}
.incl ul{list-style:none;margin-top:60px}
.incl li{font-size:21px;line-height:1.35;margin-bottom:18px;padding-left:38px;position:relative}
.incl li::before{position:absolute;left:0;top:3px;width:24px;height:24px;border-radius:50%;color:#fff;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center}
.incl.in li::before{content:"✓";background:transparent;border:2px solid var(--green);color:var(--green)}
.incl.ex li::before{content:"✕";background:var(--red)}
.costing{padding-top:80px;text-align:center}
.costing .sale{position:absolute;top:30px;left:30px;background:var(--red);color:#fff;font-family:'Oswald','Arial Narrow',Impact,sans-serif;font-size:26px;padding:4px 16px;transform:rotate(-4deg)}
.costing h2{font-family:'Montserrat',Arial,sans-serif;font-weight:900;font-size:96px;color:var(--blue-dark);letter-spacing:2px}
.costing .route{display:inline-block;color:var(--red);font-weight:700;font-size:22px;border-bottom:2px solid var(--red)}
.costing .cols{display:flex;justify-content:center;gap:110px;margin-top:40px}
.costing .col .lb{font-size:24px;color:#222}
.costing .col .lb b{display:block;color:var(--blue);font-weight:600}
.costing .price{margin-top:22px;width:300px;height:84px;background:var(--blue-dark);border:3px solid #fff;outline:3px solid var(--blue-dark);color:#fff;font-weight:600;font-size:42px;display:flex;align-items:center;justify-content:center;border-radius:6px}
.costing .gst{font-size:15px;margin-top:6px}
.costing .old{margin-top:30px;background:var(--orange);outline-color:var(--orange);position:relative}
.costing .old::after{content:"";position:absolute;left:20px;right:20px;top:50%;height:4px;background:#fff;transform:rotate(-8deg)}
.costing .notes{margin:50px auto 0;width:760px;border:2px solid var(--blue);border-radius:14px;padding:26px 24px 16px;position:relative}
.costing .notes .t{position:absolute;top:-17px;left:50%;transform:translateX(-50%);background:var(--blue);color:#fff;font-weight:700;font-size:16px;padding:3px 18px;border-radius:14px;letter-spacing:1px;white-space:nowrap}
.costing .notes p{color:var(--blue);font-weight:600;font-size:18px;line-height:1.35}
.costing .book{display:inline-flex;margin-top:28px;border:3px solid var(--orange);border-radius:6px;font-size:28px;color:var(--red);font-weight:500;overflow:hidden}
.costing .book span{padding:6px 14px}
.costing .book b{background:var(--orange);color:#fff;padding:6px 18px;font-weight:700}
.costing .soc{display:flex;justify-content:center;gap:28px;margin-top:40px}
.costing .soc span{width:60px;height:60px;border-radius:12px;background:var(--blue);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700}
.costing .redir{margin-top:20px;font-size:22px}
.costing .redir b{color:var(--blue);font-weight:600}
.costing .foot{position:absolute;bottom:0;left:0;right:0;height:46px;background:var(--blue);color:#fff;display:flex;justify-content:space-around;align-items:center;font-family:'Oswald','Arial Narrow',Impact,sans-serif;font-style:italic;font-size:20px;letter-spacing:1px}
.white-title{text-align:center;color:#fff;padding-top:90px}
.white-title h2{font-family:'Montserrat',Arial,sans-serif;font-weight:900;font-size:66px;letter-spacing:14px}
.white-title small{display:block;font-family:'Montserrat',Arial,sans-serif;font-weight:700;letter-spacing:12px;font-size:22px}
.booking .phone{position:absolute;left:80px;top:300px;width:360px;height:680px;border-radius:46px;background:#111;padding:14px;transform:rotate(-8deg);box-shadow:0 20px 40px rgba(0,0,0,.4)}
.booking .phone .ph-img{width:100%;height:100%;border-radius:34px;overflow:hidden}
.booking .bank{position:absolute;left:300px;top:300px;width:470px;background:#fff;border-radius:22px;padding:22px 26px;box-shadow:0 8px 24px rgba(0,0,0,.3)}
.booking .bank .h{display:inline-block;font-family:'Oswald','Arial Narrow',Impact,sans-serif;font-size:24px;border:2px solid #333;border-radius:20px;padding:0 16px;margin-bottom:12px}
.booking .bank p{font-size:18px;line-height:1.45}
.booking .bank p b{font-weight:700}
.booking .upi{margin-top:14px;background:#f2f4f8;border-radius:12px;padding:8px 14px;font-weight:700;font-size:16px}
.booking .bn{display:inline-block;margin-top:14px;background:var(--green);color:#fff;font-weight:700;padding:8px 24px;border-radius:20px}
.booking .pay{position:absolute;right:90px;top:560px;width:270px}
.booking .pay .c{background:#fff;border-radius:12px;padding:16px;text-align:center;margin-bottom:26px;box-shadow:0 6px 16px rgba(0,0,0,.25)}
.booking .pay .c .l{display:inline-block;background:var(--blue-dark);color:#fff;font-size:13px;font-weight:700;padding:2px 12px;border-radius:10px;margin-bottom:8px}
.booking .pay .c .gw{font-family:'Montserrat',Arial,sans-serif;font-weight:900;font-style:italic;font-size:36px;color:var(--blue-deep)}
.booking .pay .qr{width:210px;height:210px;margin:6px auto 0}
.booking .pay .qr img{width:100%;height:100%}
.booking .emi{position:absolute;left:60px;right:60px;bottom:60px;height:110px;background:#fff;border-radius:16px;display:flex;align-items:center;justify-content:center;font-family:'Montserrat',Arial,sans-serif;font-weight:800;font-size:30px;color:var(--blue-deep);gap:16px}
.booking .emi b{background:var(--orange);color:#fff;padding:4px 16px;border-radius:8px}
.policy .white-title{padding-top:60px}
.policy .pl{margin:26px auto 0;width:900px;list-style:none;background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.25);border-radius:18px;padding:22px 30px}
.policy .pl li{color:#fff;font-size:18px;line-height:1.4;font-weight:500;padding-left:30px;position:relative;margin-bottom:10px}
.policy .pl li::before{content:"";position:absolute;left:4px;top:9px;width:12px;height:12px;border-radius:50%;background:var(--yellow)}
.carry{padding:60px 60px}
.carry h2{font-family:'Montserrat',Arial,sans-serif;font-weight:900;font-size:58px;color:var(--brown);text-align:center}
.carry .scr{font-family:'Yellowtail','Brush Script MT',cursive;text-align:center;color:var(--brown);font-size:64px;margin-top:-16px}
.carry .cols{display:grid;grid-template-columns:1fr 1fr;gap:26px 50px;margin-top:20px}
.carry .grp h3{display:inline-block;font-family:'Yellowtail','Brush Script MT',cursive;font-weight:400;font-size:40px;color:#fff;background:var(--blue);padding:0 22px;border-radius:8px;margin-bottom:10px}
.carry .grp ul{list-style:none}
.carry .grp li{font-size:17px;line-height:1.35;padding-left:18px;position:relative}
.carry .grp li::before{content:"•";position:absolute;left:0;color:var(--blue);font-weight:700}
.hand{padding:56px 70px}
.hand h2{font-family:'Cinzel';font-size:66px;color:var(--blue-deep);text-align:center;line-height:1}
.hand .s1{text-align:center;font-family:'Cinzel';font-size:30px;color:var(--brown)}
.hand .s2{text-align:center;font-weight:700;font-size:14px;letter-spacing:2px;color:var(--blue-deep);margin-bottom:10px}
.hand .sec{margin-top:16px}
.hand .sec h4{display:table;margin:0 auto 8px;background:var(--yellow-2);border:1px solid #c9a400;font-family:'Oswald','Arial Narrow',Impact,sans-serif;font-weight:500;color:var(--brown);font-size:19px;padding:2px 18px}
.hand .sec ul{list-style:none}
.hand .sec li{font-size:16px;line-height:1.38;padding-left:18px;position:relative;margin-bottom:3px}
.hand .sec li::before{content:"•";position:absolute;left:2px}
.hand .sec li b{font-weight:700;color:var(--blue-deep)}
.contact{text-align:center}
.contact .vid{margin:130px auto 0;width:520px;height:380px;border:8px solid #fff;box-shadow:0 6px 18px rgba(0,0,0,.25);position:relative}
.contact .vid .ph-img{width:100%;height:100%}
.contact .vid .play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:90px;height:64px;background:var(--red);border-radius:16px}
.contact .vid .play::after{content:"";position:absolute;left:36px;top:18px;border-left:26px solid #fff;border-top:14px solid transparent;border-bottom:14px solid transparent}
.contact .brand{margin-top:90px;font-family:'Montserrat',Arial,sans-serif;font-weight:900;font-size:70px;color:var(--blue)}
.contact .tag{font-size:16px;letter-spacing:3px;color:#444}
.contact .addr{margin-top:22px;font-weight:700;font-size:22px;line-height:1.4}
.contact .chips{display:flex;justify-content:center;gap:24px;margin-top:70px;flex-wrap:wrap;padding:0 40px}
.contact .chips span{border:2px solid var(--green);border-radius:24px;padding:8px 22px;font-size:18px;font-weight:500}
.contact .rate{display:flex;justify-content:center;gap:20px;margin-top:60px}
.contact .rate span{border:2px solid var(--blue);border-radius:22px;padding:6px 20px;font-weight:600;color:var(--blue)}
.dayp .bar .dn,.dayp .bar .km{flex:none;white-space:nowrap}
.dayp .bar .tt{white-space:nowrap}
.dayp .bar.two{height:auto}
.dayp .bar.two .tt{white-space:normal;height:auto;min-height:58px;line-height:1.08;padding-top:7px;padding-bottom:7px}
.incl ul.two{columns:2;column-gap:44px}
.incl ul.two li{break-inside:avoid}
.costing .cols.many{gap:40px;flex-wrap:wrap;padding:0 60px}
`;

/** Prefixes every rule with the scope (":root" becomes the scope itself). */
function scope(css: string, root: string): string {
  return css.replace(/([^{}]+)\{/g, (_m, sel: string) => {
    const scoped = sel
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (s === ':root' ? root : `${root} ${s}`))
      .join(',');
    return `${scoped}{`;
  });
}

export const ADVENTURE_CSS = scope(RAW, '.advb');
