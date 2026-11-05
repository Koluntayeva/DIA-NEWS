/* The feed. Replace this file's contents to publish real news.
   demo:true shows the demo banner; set it to false once the stories are real.
   items[]: {id, cat, stage, date:"YYYY-MM-DD", added?, title, text, facts?:[{k,v}], body?, url?, src?, photo?:{url,credit,license,link}}
            cat is one of CATS in js/i18n.js; title/text/body/k/v are {ru,en,kk,de,es} objects (missing languages fall back to en, then ru).
   posts[]: {date, ru, kk}: the Telegram post box in the rail. Empty hides it.
   events[]: {name, start, end?, place?, url?}: the conference calendar. Empty hides it. */
const DIA_NEWS=(()=>{
  const d=(n)=>{const x=new Date();x.setDate(x.getDate()-n);return x.toISOString().slice(0,10)};
  const T=(ru,en)=>({ru,en});
  return {
  demo:true,
  items:[
   {id:"d1",cat:"devices",stage:"launch",date:d(0),title:T("Пример: новый 15-дневный датчик глюкозы выходит на рынок","Example: a new 15-day glucose sensor reaches the market"),text:T("Демо-материал для предпросмотра. Здесь будет пересказ новости о CGM-датчике: точность, срок ношения, совместимость с помпами.","Preview demo. A summary of CGM news goes here: accuracy, wear time, pump compatibility."),facts:[{k:T("Срок ношения","Wear time"),v:T("15 дней","15 days")},{k:T("Прогрев","Warm-up"),v:T("30 минут","30 minutes")}],body:T("Демо-текст. Полный пересказ появится, когда лента загрузится из базы.","Demo text. The full summary appears once the live feed loads.")},
   {id:"d2",cat:"research",stage:"phase2",date:d(1),title:T("Пример: исследование клеточной терапии при диабете 1 типа","Example: a cell-therapy study in type 1 diabetes"),text:T("Демо-материал: ранние результаты исследования островковых клеток.","Demo: early results from an islet-cell study.")},
   {id:"d3",cat:"drugs",stage:"phase3",date:d(1),title:T("Пример: еженедельный базальный инсулин при диабете 2 типа","Example: once-weekly basal insulin in type 2 diabetes"),text:T("Демо-материал: данные 3 фазы по контролю HbA1c.","Demo: phase 3 data on HbA1c control.")},
   {id:"d4",cat:"approval",stage:"approved",date:d(2),title:T("Пример: регулятор одобрил систему автоматической доставки инсулина","Example: regulator approves an automated insulin delivery system"),text:T("Демо-материал о новом одобрении.","Demo item about a new approval.")},
   {id:"d5",cat:"access",stage:"policy",date:d(3),title:T("Пример: датчики глюкозы включены в программу компенсации","Example: glucose sensors added to a reimbursement programme"),text:T("Демо-материал о доступности CGM.","Demo item on CGM access.")},
   {id:"d6",cat:"community",stage:"community",date:d(4),title:T("Пример: школа диабета для подростков и родителей","Example: a diabetes school for teens and parents"),text:T("Демо-материал о диасообществе.","Demo item from the community.")},
   {id:"d7",cat:"events",stage:"conference",date:d(5),title:T("Пример: главные доклады осеннего конгресса по диабету","Example: highlights from an autumn diabetes congress"),text:T("Демо-материал о конференции.","Demo conference item.")}
  ],
  stats:{year:"2021",adults:537e6,t2d_share_min:90,t1d:8750000,t1d_kids:1211900,src:"IDF Diabetes Atlas 2021 · T1D Index 2022 (демо)",url:"https://diabetesatlas.org/"},
  posts:[],
  events:[]
  };
})();
