const KEY="pm_crane_app_v1";
const defaults={
  settings:{businessName:"PM CRANE SERVICE",subtitle:"CRANE OWNERS & HIRERS",services:"MOBILE, TELESCOPIC, HYDRA & FARANA CRANE.",address:"303, Vaishnavidevi Apt “A” wing, Suresh Nagar, Diva (E), Thane 400612",gstin:"27BWRPS0511G1ZE",email:"pmcraneservices@gmail.com",phones:"9892826124 / 9833555524",bankName:"HDFC Bank",accountNo:"50200079318402",branch:"Mumbai",ifsc:"HDFC0000060",udyam:"MH-33-0089092",prefix:"",defaultGST:18,signatureImage:"signature.png"},
  customers:[], invoices:[], nextInvoice:98
};
let db=loadDB(), editingInvoiceId=null;

function loadDB(){
  try{
    const stored=JSON.parse(localStorage.getItem(KEY)||"null");
    if(!stored || typeof stored!=="object") return structuredClone(defaults);
    return {
      ...structuredClone(defaults),
      ...stored,
      settings:{...structuredClone(defaults.settings),...(stored.settings||{})},
      customers:Array.isArray(stored.customers)?stored.customers:[],
      invoices:Array.isArray(stored.invoices)?stored.invoices:[],
      nextInvoice:Number.isFinite(Number(stored.nextInvoice))?Number(stored.nextInvoice):defaults.nextInvoice
    };
  }catch(error){
    console.error("Could not read saved invoice data:",error);
    return structuredClone(defaults);
  }
}
function saveDB(){
  try{localStorage.setItem(KEY,JSON.stringify(db));}
  catch(error){alert("Could not save data in this browser. Export a backup and check available browser storage.");console.error(error);return false;}
  updateDashboard(); renderInvoices(); renderCustomers(); fillCustomerSelect(); return true;
}
function money(n){return "₹"+Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}
function dateISO(d=new Date()){
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function fmtDate(v){if(!v)return "";const [y,m,d]=v.split("-");return `${d}/${m}/${y}`}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function numWords(n){
  n=Math.round(Number(n)||0); if(n===0)return "Zero Rupees Only.";
  const ones=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const two=x=>x<20?ones[x]:tens[Math.floor(x/10)]+(x%10?"-"+ones[x%10]:"");
  const chunk=x=>{let s="";if(x>=100){s+=ones[Math.floor(x/100)]+" Hundred";x%=100;if(x)s+=" ";}if(x)s+=two(x);return s};
  let parts=[]; const crore=Math.floor(n/1e7); n%=1e7; const lakh=Math.floor(n/1e5); n%=1e5; const thousand=Math.floor(n/1e3); n%=1e3;
  if(crore)parts.push(chunk(crore)+" Crore"); if(lakh)parts.push(chunk(lakh)+" Lakh"); if(thousand)parts.push(chunk(thousand)+" Thousand"); if(n)parts.push(chunk(n));
  return parts.join(" ")+" Rupees Only.";
}
function freshLine(){return {craneType:"70 TON",regNo:"",description:"Crane working in your job for loading & unloading purpose. Your job site.",sac:"997311",udyam:db.settings.udyam,unit:"1",billingType:"Per Shift",rate:40000,qty:1}}
function newInvoice(){
  editingInvoiceId=null;
  setVal("invoiceNo",db.nextInvoice); setVal("invoiceDate",dateISO()); setVal("monthDate",dateISO());
  ["workOrder","confirmation","customerName","customerGSTIN","customerAddress","customerEmail","customerContact","customerMobile"].forEach(id=>setVal(id,""));
  setVal("customerSelect","");
  setVal("taxMode","cgstsgst"); setVal("cgstRate",9); setVal("sgstRate",9); setVal("igstRate",18);
  document.getElementById("line-items").innerHTML=""; addLine(); calculate(); renderPreview();
}
function setVal(id,v){document.getElementById(id).value=v??""}
function getVal(id){return document.getElementById(id).value}
function addLine(data=freshLine()){
 const wrap=document.createElement("div"); wrap.className="line-editor";
 wrap.innerHTML=`<div class="line-grid">
 <label>Crane Type<input data-k="craneType" value="${esc(data.craneType)}"></label>
 <label>Registration No.<input data-k="regNo" value="${esc(data.regNo)}"></label>
 <label>SAC Code<input data-k="sac" value="${esc(data.sac)}"></label>
 <label>Unit<input data-k="unit" value="${esc(data.unit)}"></label>
 <label>Rate<input data-k="rate" type="number" step="0.01" value="${data.rate||0}"></label>
 <label class="description">Job Description<textarea data-k="description" rows="2">${esc(data.description)}</textarea></label>
 <label>UDYAM<input data-k="udyam" value="${esc(data.udyam)}"></label>
 <label>Billing Type<select data-k="billingType"><option ${data.billingType==="Per Shift"?"selected":""}>Per Shift</option><option ${data.billingType==="Per Day"?"selected":""}>Per Day</option><option ${data.billingType==="Lumpsum"?"selected":""}>Lumpsum</option></select></label>
 <label>Quantity / Shifts<input data-k="qty" type="number" min="0" step="0.01" value="${data.qty||0}"></label>
 <div class="remove"><button class="remove-line" type="button">Remove</button></div>
 </div>`;
 wrap.querySelector(".remove-line").onclick=()=>{wrap.remove();calculate();renderPreview()};
 wrap.querySelectorAll("input,textarea,select").forEach(x=>x.addEventListener("input",()=>{calculate();renderPreview()}));
 document.getElementById("line-items").appendChild(wrap);
}
function lines(){
 return [...document.querySelectorAll(".line-editor")].map(w=>Object.fromEntries([...w.querySelectorAll("[data-k]")].map(x=>[x.dataset.k,x.type==="number"?Number(x.value):x.value])));
}
function totals(){
 const taxable=lines().reduce((a,l)=>a+(Number(l.rate)||0)*(Number(l.qty)||0),0);
 const mode=getVal("taxMode"), cgst=mode==="cgstsgst"?taxable*(Number(getVal("cgstRate"))||0)/100:0, sgst=mode==="cgstsgst"?taxable*(Number(getVal("sgstRate"))||0)/100:0, igst=mode==="igst"?taxable*(Number(getVal("igstRate"))||0)/100:0;
 const raw=taxable+cgst+sgst+igst, rounded=Math.round(raw), round=rounded-raw;
 return {taxable,cgst,sgst,igst,round,grand:rounded};
}
function calculate(){const t=totals();setText("sum-taxable",money(t.taxable));setText("sum-cgst",money(t.cgst));setText("sum-sgst",money(t.sgst));setText("sum-igst",money(t.igst));setText("sum-round",money(t.round));setText("sum-grand",money(t.grand))}
function setText(id,v){document.getElementById(id).textContent=v}
function getInvoice(){
 const t=totals();
 return {id:editingInvoiceId||crypto.randomUUID(),invoiceNo:Number(getVal("invoiceNo")),invoiceDate:getVal("invoiceDate"),monthDate:getVal("monthDate"),workOrder:getVal("workOrder"),confirmation:getVal("confirmation"),customer:{name:getVal("customerName"),gstin:getVal("customerGSTIN"),address:getVal("customerAddress"),email:getVal("customerEmail"),contact:getVal("customerContact"),mobile:getVal("customerMobile")},lines:lines(),taxMode:getVal("taxMode"),cgstRate:Number(getVal("cgstRate")),sgstRate:Number(getVal("sgstRate")),igstRate:Number(getVal("igstRate")),totals:t,createdAt:new Date().toISOString(),status:"Saved"}}
function loadInvoice(inv){
 editingInvoiceId=inv.id; ["invoiceNo","invoiceDate","monthDate","workOrder","confirmation"].forEach(k=>setVal(k,inv[k]));
 setVal("customerName",inv.customer.name);setVal("customerGSTIN",inv.customer.gstin);setVal("customerAddress",inv.customer.address);setVal("customerEmail",inv.customer.email);setVal("customerContact",inv.customer.contact);setVal("customerMobile",inv.customer.mobile);
 setVal("taxMode",inv.taxMode);setVal("cgstRate",inv.cgstRate);setVal("sgstRate",inv.sgstRate);setVal("igstRate",inv.igstRate);
 document.getElementById("line-items").innerHTML="";inv.lines.forEach(addLine);calculate();renderPreview();go("invoice");
}
function saveInvoice(){
 const inv=getInvoice();
 if(!inv.customer.name.trim())return alert("Customer name is required.");
 if(!/^\d+$/.test(String(inv.invoiceNo)))return alert("Invoice number is required.");
 if(inv.lines.some(l=>(Number(l.rate)||0)<0||(Number(l.qty)||0)<=0))return alert("Rate and quantity/shifts must be valid.");
 const duplicate=db.invoices.find(x=>x.invoiceNo===inv.invoiceNo&&x.id!==inv.id); if(duplicate)return alert("That invoice number already exists.");
 const idx=db.invoices.findIndex(x=>x.id===inv.id); if(idx>=0)db.invoices[idx]=inv;else db.invoices.unshift(inv);
 db.nextInvoice=Math.max(db.nextInvoice,inv.invoiceNo+1);saveDB();editingInvoiceId=inv.id;alert("Invoice saved.");renderPreview();
}
function renderPreview(){
 const s=db.settings, i=getInvoice(), t=i.totals, mode=i.taxMode;
 const rows=i.lines.length?i.lines.map(l=>`<div class="item-row"><div><b>${esc(l.craneType)}</b>${l.regNo?`<br>${esc(l.regNo)}`:""} ${esc(l.description)}${l.udyam?`<br><br>UDYAM<br>${esc(l.udyam)}`:""}</div><div style="text-align:center">${esc(l.sac)}</div><div style="text-align:center">${esc(l.unit)}</div><div style="text-align:center">${esc(l.billingType)}<br>${money(l.rate)}<br><br>${esc(l.qty)} Shift${Number(l.qty)===1?"":"s"}</div><div style="text-align:right">${money((Number(l.rate)||0)*(Number(l.qty)||0))}</div></div>`).join(""):"<div class='item-row'><div></div><div></div><div></div><div></div><div></div></div>";
 const taxRows=`<div class="sum-row"><div>CGST</div><div></div><div></div><div>${mode==="cgstsgst"?esc(i.cgstRate)+"%":""}</div><div style="text-align:right">${money(t.cgst)}</div></div><div class="sum-row"><div>SGST / IGST</div><div></div><div></div><div>${mode==="cgstsgst"?esc(i.sgstRate)+"%":mode==="igst"?esc(i.igstRate)+"%":""}</div><div style="text-align:right">${money(mode==="igst"?t.igst:t.sgst)}</div></div>`;
 const craneLeft=`<img src="crane-left.png" alt="Mobile crane">`;
 const craneRight=`<img src="crane-right.png" alt="Crane">`;
 document.getElementById("invoice-preview").innerHTML=`<div class="inv-border">
 <div class="inv-header"><div class="crane-icon crane-left">${craneLeft}</div><div class="crane-icon crane-right">${craneRight}</div><div class="inv-title">${esc(s.businessName)}</div><div class="inv-sub">${esc(s.subtitle)}</div><div class="inv-services">${esc(s.services)}</div><div class="inv-address">Address : ${esc(s.address)}</div><div class="inv-contact">GSTN : ${esc(s.gstin)}, EMAIL ID : ${esc(s.email)}, MO NO: ${esc(s.phones)}</div><div class="tax-invoice">TAX INVOICE</div></div>
 <div class="info-grid">
 <div><span class="info-label">To,</span><br><br><span class="info-label">Name :</span></div><div class="customer-name">${esc(i.customer.name).replace(/\n/g,"<br>")}</div><div><span class="info-label">Invoice Date</span></div><div>${fmtDate(i.invoiceDate)}</div>
 <div><span class="info-label">Address :</span></div><div class="customer-address">${esc(i.customer.address).replace(/\n/g,"<br>")}</div><div><span class="info-label">Invoice No.</span></div><div>${esc(i.invoiceNo)}</div>
 <div><span class="info-label">GSTNO :</span> ${esc(i.customer.gstin)}</div><div class="customer-address">Email: <span class="email-link">${esc(i.customer.email)}</span></div><div><span class="info-label">Month Date.</span></div><div>${fmtDate(i.monthDate)}</div>
 <div><span class="info-label">Work Order No.</span></div><div>${esc(i.workOrder)}</div><div><span class="info-label">Confirmation</span></div><div>${esc(i.confirmation)}</div>
 </div>
 <div class="items-head"><div>Particulars</div><div>SAC Code</div><div>Unit</div><div>Rate</div><div>Taxable Amt.</div></div>${rows}
 <div class="sum-row"><div class="sum-label">Total</div><div style="text-align:right">${money(t.taxable)}</div></div>${taxRows}
 <div class="sum-row"><div class="sum-label">(Round off)</div><div style="text-align:right">${money(t.round)}</div></div>
 <div class="sum-row"><div class="sum-label">Total Amount</div><div style="text-align:right;font-weight:700">${money(t.grand)}</div></div>
 <div class="sum-row"><div class="amount-words">In Words : ${esc(numWords(t.grand))}</div><div></div></div>
 <div class="footer-area"><div class="bank"><b>Bank Details:</b><br>Bank: ${esc(s.bankName)}<br>AC No. ${esc(s.accountNo)}<br>Branch: ${esc(s.branch)}<br>IFSC Code : ${esc(s.ifsc)}</div><div class="sign">${s.signatureImage?`<img class="invoice-signature" src="${esc(s.signatureImage)}" alt="Authorised signature">`:`For ${esc(s.businessName)}<br><br><br><b>Proprietor</b>`}</div></div>
 <div class="certificate">Certified that the particular given are true and correct.</div><div class="thank">Thank you</div>
 </div>`;
}
function fillCustomerSelect(){const el=document.getElementById("customerSelect");el.innerHTML='<option value="">— New customer —</option>'+db.customers.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("")}
function renderCustomers(filter=""){const body=document.getElementById("customer-list");const q=filter.toLowerCase();body.innerHTML=db.customers.filter(c=>`${c.name} ${c.gstin} ${c.contact}`.toLowerCase().includes(q)).map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.gstin)}</td><td>${esc(c.contact)}</td><td>${esc(c.mobile)}</td><td><button onclick="editCustomer('${c.id}')">Edit</button><button onclick="deleteCustomer('${c.id}')">Delete</button></td></tr>`).join("")||'<tr><td colspan="5">No customers yet.</td></tr>'}
function renderInvoices(filter=""){const body=document.getElementById("invoice-list"),q=filter.toLowerCase();body.innerHTML=db.invoices.filter(i=>`${i.invoiceNo} ${i.customer.name}`.toLowerCase().includes(q)).map(i=>{const gst=i.totals.cgst+i.totals.sgst+i.totals.igst;return `<tr><td>${i.invoiceNo}</td><td>${esc(i.customer.name)}</td><td>${fmtDate(i.invoiceDate)}</td><td>${money(i.totals.taxable)}</td><td>${money(gst)}</td><td>${money(i.totals.grand)}</td><td>${i.status}</td><td><button onclick="viewInvoice('${i.id}')">View</button><button onclick="editSaved('${i.id}')">Edit</button><button onclick="duplicateSaved('${i.id}')">Duplicate</button><button onclick="pdfSaved('${i.id}')">PDF</button><button onclick="deleteInvoice('${i.id}')">Delete</button></td></tr>`}).join("")||'<tr><td colspan="8">No saved invoices.</td></tr>'}
function updateDashboard(){document.getElementById("stat-invoices").textContent=db.invoices.length;document.getElementById("stat-customers").textContent=db.customers.length;document.getElementById("stat-last").textContent=db.invoices[0]?db.invoices[0].invoiceNo:"—"}
function go(page){document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="page-"+page));document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.page===page));document.getElementById("page-title").textContent=page==="invoice"?"Create New Invoice":page==="invoices"?"Saved Invoices":page==="customers"?"Customers / Vendors":page==="settings"?"Company Settings":"Dashboard";if(page==="invoice")renderPreview()}
function openModal(c=null){document.getElementById("modal").classList.remove("hidden");document.getElementById("modal-id").value=c?.id||"";document.getElementById("modal-name").value=c?.name||"";document.getElementById("modal-gstin").value=c?.gstin||"";document.getElementById("modal-address").value=c?.address||"";document.getElementById("modal-email").value=c?.email||"";document.getElementById("modal-contact").value=c?.contact||"";document.getElementById("modal-mobile").value=c?.mobile||""}
function editCustomer(id){openModal(db.customers.find(c=>c.id===id))}
function deleteCustomer(id){if(confirm("Delete this customer?")){db.customers=db.customers.filter(c=>c.id!==id);saveDB()}}
function saveCustomerModal(){const c={id:document.getElementById("modal-id").value||crypto.randomUUID(),name:document.getElementById("modal-name").value.trim(),gstin:document.getElementById("modal-gstin").value.trim(),address:document.getElementById("modal-address").value.trim(),email:document.getElementById("modal-email").value.trim(),contact:document.getElementById("modal-contact").value.trim(),mobile:document.getElementById("modal-mobile").value.trim()};if(!c.name)return alert("Company name is required.");const idx=db.customers.findIndex(x=>x.id===c.id);if(idx>=0)db.customers[idx]=c;else db.customers.push(c);saveDB();document.getElementById("modal").classList.add("hidden")}
function saveInlineCustomer(){const c={id:crypto.randomUUID(),name:getVal("customerName").trim(),gstin:getVal("customerGSTIN").trim(),address:getVal("customerAddress").trim(),email:getVal("customerEmail").trim(),contact:getVal("customerContact").trim(),mobile:getVal("customerMobile").trim()};if(!c.name)return alert("Company name is required.");db.customers.push(c);saveDB();fillCustomerSelect();alert("Customer saved.")}
function loadSettings(){document.querySelectorAll("[data-setting]").forEach(el=>el.value=db.settings[el.dataset.setting]??"");const p=document.getElementById("signature-preview");if(p){p.src=db.settings.signatureImage||"";p.style.display=db.settings.signatureImage?"block":"none"}}
function saveSettings(){document.querySelectorAll("[data-setting]").forEach(el=>db.settings[el.dataset.setting]=el.value);saveDB();alert("Settings saved.");renderPreview()}
function duplicateInvoice(inv){const copy=JSON.parse(JSON.stringify(inv));copy.id=crypto.randomUUID();copy.invoiceNo=db.nextInvoice++;copy.invoiceDate=dateISO();copy.monthDate=dateISO();copy.createdAt=new Date().toISOString();copy.status="Saved";db.invoices.unshift(copy);saveDB();loadInvoice(copy)}
async function makePDF(){
 const node=document.getElementById("invoice-preview"),canvas=await html2canvas(node,{scale:2,backgroundColor:"#fff",useCORS:true});
 const {jsPDF}=window.jspdf;const pdf=new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
 const img=canvas.toDataURL("image/png"),w=210,h=297,ratio=Math.min(w/(canvas.width),h/(canvas.height));pdf.addImage(img,"PNG",(w-canvas.width*ratio)/2,0,canvas.width*ratio,canvas.height*ratio);pdf.save(`PM_Crane_Invoice_${getVal("invoiceNo")}.pdf`);
}
function viewInvoice(id){loadInvoice(db.invoices.find(x=>x.id===id))}
function editSaved(id){loadInvoice(db.invoices.find(x=>x.id===id))}
function duplicateSaved(id){duplicateInvoice(db.invoices.find(x=>x.id===id))}
function deleteInvoice(id){if(confirm("Delete this invoice?")){db.invoices=db.invoices.filter(x=>x.id!==id);saveDB()}}
function pdfSaved(id){loadInvoice(db.invoices.find(x=>x.id===id));setTimeout(makePDF,150)}
function exportBackup(){
  const payload={app:"PM Crane Service Invoice Generator",version:1,exportedAt:new Date().toISOString(),data:db};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`PM_Crane_Backup_${dateISO()}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
function importBackupFile(file){
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const parsed=JSON.parse(reader.result);
      const incoming=parsed?.data||parsed;
      if(!incoming||!Array.isArray(incoming.invoices)||!Array.isArray(incoming.customers)||typeof incoming.settings!=="object"){
        throw new Error("This file does not look like a PM Crane backup.");
      }
      if(!confirm("Importing a backup will replace the invoices, customers and settings currently saved in this browser. Export your current data first if you need it. Continue?"))return;
      db={
        ...structuredClone(defaults),...incoming,
        settings:{...structuredClone(defaults.settings),...(incoming.settings||{})},
        invoices:incoming.invoices,
        customers:incoming.customers,
        nextInvoice:incoming.invoices.reduce((next,i)=>Math.max(next,(Number(i.invoiceNo)||0)+1),Math.max(Number(incoming.nextInvoice)||defaults.nextInvoice,defaults.nextInvoice))
      };
      if(saveDB()){loadSettings();newInvoice();go("dashboard");alert("Backup imported successfully.");}
    }catch(error){alert(error.message||"Could not import this backup. Please select a valid JSON backup.");}
  };
  reader.onerror=()=>alert("Could not read the selected backup file.");
  reader.readAsText(file);
}

document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>{if(b.dataset.page==="invoice"&&!editingInvoiceId)newInvoice();go(b.dataset.page)}));
document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",()=>{if(b.dataset.page==="invoice")newInvoice();go(b.dataset.page)}));
document.getElementById("quick-new").onclick=()=>{newInvoice();go("invoice")};
document.getElementById("add-line").onclick=()=>{addLine();calculate();renderPreview()};
document.getElementById("save-invoice").onclick=saveInvoice;
document.getElementById("download-pdf").onclick=makePDF;
document.getElementById("print-invoice").onclick=()=>window.print();
document.getElementById("duplicate-current").onclick=()=>duplicateInvoice(getInvoice());
document.getElementById("save-customer-inline").onclick=saveInlineCustomer;
document.getElementById("add-customer").onclick=()=>openModal();
document.getElementById("modal-close").onclick=()=>document.getElementById("modal").classList.add("hidden");
document.getElementById("modal-save").onclick=saveCustomerModal;
document.getElementById("customer-search").oninput=e=>renderCustomers(e.target.value);
document.getElementById("invoice-search").oninput=e=>renderInvoices(e.target.value);
document.getElementById("save-settings").onclick=saveSettings;
document.getElementById("signature-file").onchange=e=>{const file=e.target.files?.[0];if(!file)return;if(!["image/png","image/jpeg"].includes(file.type))return alert("Please choose a PNG or JPG image.");if(file.size>5*1024*1024)return alert("Please choose an image smaller than 5 MB.");const reader=new FileReader();reader.onload=()=>{const im=new Image();im.onload=()=>{const scale=Math.min(1,700/im.width);const c=document.createElement("canvas");c.width=Math.round(im.width*scale);c.height=Math.round(im.height*scale);c.getContext("2d").drawImage(im,0,0,c.width,c.height);db.settings.signatureImage=c.toDataURL("image/png");saveDB();loadSettings();renderPreview()};im.src=reader.result};reader.readAsDataURL(file);e.target.value=""};
document.getElementById("remove-signature").onclick=()=>{if(confirm("Remove the signature from future invoices?")){db.settings.signatureImage="";saveDB();loadSettings();renderPreview()}};
document.getElementById("export-backup").onclick=exportBackup;
document.getElementById("import-backup-trigger").onclick=()=>document.getElementById("import-backup-file").click();
document.getElementById("import-backup-file").onchange=e=>{importBackupFile(e.target.files?.[0]);e.target.value="";};
document.getElementById("reset-settings").onclick=()=>{if(confirm("Reset company settings to defaults?")){db.settings=structuredClone(defaults.settings);saveDB();loadSettings();renderPreview()}};
document.getElementById("customerSelect").onchange=e=>{const c=db.customers.find(x=>x.id===e.target.value);if(c){setVal("customerName",c.name);setVal("customerGSTIN",c.gstin);setVal("customerAddress",c.address);setVal("customerEmail",c.email);setVal("customerContact",c.contact);setVal("customerMobile",c.mobile);renderPreview()}};
["invoiceNo","invoiceDate","monthDate","workOrder","confirmation","customerName","customerGSTIN","customerAddress","customerEmail","customerContact","customerMobile","taxMode","cgstRate","sgstRate","igstRate"].forEach(id=>document.getElementById(id).addEventListener("input",()=>{calculate();renderPreview()}));

fillCustomerSelect();renderCustomers();renderInvoices();updateDashboard();loadSettings();newInvoice();go("dashboard");
window.editCustomer=editCustomer;window.deleteCustomer=deleteCustomer;window.viewInvoice=viewInvoice;window.editSaved=editSaved;window.duplicateSaved=duplicateSaved;window.deleteInvoice=deleteInvoice;window.pdfSaved=pdfSaved;