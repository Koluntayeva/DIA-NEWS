/* Stock photos and how they are assigned to stories. */
const CM=n=>"https://commons.wikimedia.org/wiki/Special:FilePath/"+encodeURIComponent(n)+"?width=960";
const PH=(file,credit,license)=>({file,credit,license,link:"https://commons.wikimedia.org/wiki/File:"+encodeURIComponent(file.replace(/ /g,"_"))});
const MG=(img,page,credit)=>({url:"https://img.magnific.com/free-photo/"+img+".jpg?w=1200",credit:"Image by "+credit,license:"Magnific",link:"https://www.magnific.com/free-photo/"+page+".htm"});
const SRC=p=>p.url||CM(p.file);
const UP=(f,credit)=>({url:"assets/photos/"+f,credit,license:"Magnific",link:"https://www.magnific.com/"});
const STOCK={
 up_patch1:UP("glucose-patch-sensor.jpg","Image by Magnific"),
 up_patch2:UP("glucose-patch-sensor.jpg","Image by Magnific"),
 up_person:UP("glucose-level-check.jpg","Image by Magnific"),
 mg_woman1:MG("high-angle-diabetic-woman-checking-her-glucose-level_23-2150756373","high-angle-diabetic-woman-checking-her-glucose-level_65609387","magnific"),
 mg_woman2:MG("top-view-diabetic-woman-checking-her-glucose-level_23-2150756365","top-view-diabetic-woman-checking-her-glucose-level_65609403","magnific"),
 mg_person1:MG("diabetic-person-checking-their-glucose-level_52683-135700","diabetic-person-checking-their-glucose-level_65654084","pikisuperstar"),
 mg_person2:MG("diabetic-person-checking-their-glucose-level_52683-135679","diabetic-person-checking-their-glucose-level_65654079","pikisuperstar"),
 mg_doctor:MG("doctor-consulting-senior-patient_482257-74496","doctor-consulting-senior-patient_132103601","DC Studio"),
 libre7:PH("FreeStyle libre am Oberarm und Auslesegerät-7.jpg","Thirunavukkarasye-Raveendran","CC BY 4.0"),
 libre5:PH("FreeStyle libre am Oberarm und Auslesegerät-5.JPG","Thirunavukkarasye-Raveendran","CC BY 4.0"),
 cgm14:PH("2018.11.03 Continuous Glucose Monitor 14 day, Washington, DC USA (43893894210).jpg","Ted Eytan","CC BY-SA 2.0"),
 pump780:PH("Medtronic MiniMed 780G insulinpump.jpg","MailariX / Wikimedia Commons",""),
 libre3app:PH("Abbott Freestyle Libre 3 sensor applicator-1150.jpg","Raimond Spekking","CC BY-SA 4.0"),
 libre2:PH("Abbott Freestyle Libre 2 glucose sensor-1159.jpg","Raimond Spekking","CC BY-SA 4.0"),
 lab1:PH("Pipetting activities.jpg","NCI","Public domain"),
 lab2:PH("NHGRI researcher uses a pipette to remove DNA from a micro test tube.jpg","Maggie Bartlett, NHGRI","Public domain"),
 doc1:PH("Doctor consults with patient (7).jpg","Bill Branson, NCI","Public domain"),
 doc2:PH("Doctor talking with a patient.jpg","NCI","Public domain"),
 doc3:PH("Couple consults with doctor.jpg","NCI","Public domain"),
 doc4:PH("Doctor consults with patient (4).jpg","NCI","Public domain"),
 doc5:PH("Doctor examines patient.jpg","NCI","Public domain"),
 pen1:PH("Insulin pen in I-Port Advance.jpg","Marius Vassnes",""),
 pen3:PH("Green insulin pen (Insulatard insulin).jpg","Marius Vassnes",""),
 walk:PH("Participants of a walk against Diabetes and for general fitness around Nauru airport.jpg","Lorrie Graham / AusAID","CC BY 2.0"),
 run:PH("World Diabetes Day Fun Run in Maldives (150).jpg","The President's Office, Maldives",""),
};
const CAT_PHOTOS={devices:["up_patch1","up_patch2","libre7","mg_person1","cgm14","libre5","pump780","libre2"],drugs:["up_person","mg_person2","pen1","pen3","mg_woman2"],access:["mg_doctor","mg_woman2","doc3"],approval:["mg_doctor","doc1","doc4","libre3app"],research:["lab1","lab2","doc5"],market:["up_patch2","libre3app","pump780","libre2"],events:["run","walk"],community:["walk","run","mg_woman2"]}
const POOL=Object.keys(STOCK);let PHOTO_MAP=new Map(),PHOTO_SIG="";
function assignPhotos(){const sig=items.map(i=>i._id+i.cat).join(",");if(sig===PHOTO_SIG)return;PHOTO_SIG=sig;PHOTO_MAP=new Map();const used=new Set();
  for(const it of items){const pref=(CAT_PHOTOS[it.cat]||[]).concat(POOL);let k=pref.find(p=>!used.has(p));if(!k){used.clear();k=pref[0]}used.add(k);PHOTO_MAP.set(it._id,k)}}
function stockFor(it){assignPhotos();return STOCK[PHOTO_MAP.get(it._id)]||STOCK.mg_woman1}
