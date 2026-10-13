// ================= Langues : Français (par défaut) · العربية · English =================
// Traduction de l'interface à l'affichage : chaque texte de l'interface est remplacé par sa traduction
// (les données saisies — noms d'ouvrages, notes… — restent telles quelles).
const LANGS = [['fr', 'Français'], ['ar', 'العربية'], ['en', 'English']];
const Lang = { cur: (() => { try { return localStorage.getItem('lang') || 'fr'; } catch (e) { return 'fr'; } })(), map: null };
const I18N_DATA = `
Mes chantiers|أوراشي|My sites
Nouveau projet|مشروع جديد|New project
Nom du projet|اسم المشروع|Project name
Adresse / ville (optionnel)|العنوان / المدينة (اختياري)|Address / city (optional)
Adresse / ville|العنوان / المدينة|Address / city
Créer|إنشاء|Create
Annuler|إلغاء|Cancel
Enregistrer|حفظ|Save
Valider|تأكيد|Confirm
Supprimer|حذف|Delete
Modifier|تعديل|Edit
Renommer|إعادة التسمية|Rename
Fermer|إغلاق|Close
Ouvrir|فتح|Open
Ouvrir le projet|فتح المشروع|Open project
Partager|مشاركة|Share
Partager (WhatsApp…)|مشاركة (واتساب…)|Share (WhatsApp…)
Ajouter|إضافة|Add
Suivant|التالي|Next
Appliquer|تطبيق|Apply
Importer|استيراد|Import
Voir|عرض|View
Tout|الكل|All
Toutes|الكل|All
OK|موافق|OK
Oui, les reprendre|نعم، استرجاعها|Yes, restore them
Plus tard|لاحقاً|Later
Pas encore|ليس بعد|Not yet
Effacer|مسح|Clear
Tout effacer|مسح الكل|Clear all
Tout effacer ?|مسح الكل؟|Clear all?
Copié ✓|تم النسخ ✓|Copied ✓
Enregistré ✓|تم الحفظ ✓|Saved ✓
Supprimé ✓|تم الحذف ✓|Deleted ✓
Ajouté ✓|تمت الإضافة ✓|Added ✓
À jour ✓|محدّث ✓|Up to date ✓
Chargement…|جارٍ التحميل…|Loading…
Ouverture…|جارٍ الفتح…|Opening…
Enregistrement…|جارٍ الحفظ…|Saving…
Création…|جارٍ الإنشاء…|Creating…
Mise à jour…|جارٍ التحديث…|Updating…
Lecture…|جارٍ القراءة…|Reading…
Chantier|الورش|Site
CHANTIER|الورش|SITE
Projet|المشروع|Project
Plans|التصاميم|Plans
Plans récents|التصاميم الأخيرة|Recent plans
Aucun plan.|لا توجد تصاميم.|No plans.
Aucun plan ouvert récemment|لم يُفتح أي تصميم مؤخراً|No plan opened recently
Ajouter un plan|إضافة تصميم|Add a plan
Ajouter un plan ici|إضافة تصميم هنا|Add a plan here
Importer un plan (PDF / image)|استيراد تصميم (PDF / صورة)|Import a plan (PDF / image)
Plan importé ✓|تم استيراد التصميم ✓|Plan imported ✓
Import du plan…|جارٍ استيراد التصميم…|Importing plan…
Ouverture du plan…|جارٍ فتح التصميم…|Opening plan…
Nom du plan|اسم التصميم|Plan name
Supprimer le plan|حذف التصميم|Delete plan
Plan coffrage|تصميم الكوفراج|Formwork plan
Plan ferraillage|تصميم الحديد|Reinforcement plan
Coupe|مقطع|Section
Nouveau dossier|مجلد جديد|New folder
Nouveau dossier (niveau)|مجلد جديد (مستوى)|New folder (level)
Nom du dossier|اسم المجلد|Folder name
Nom du dossier / niveau|اسم المجلد / المستوى|Folder / level name
Sans dossier|بدون مجلد|No folder
Supprimer le dossier|حذف المجلد|Delete folder
Couleur|اللون|Color
Couleur du dossier|لون المجلد|Folder color
Changer la couleur|تغيير اللون|Change color
Dans quel dossier ?|في أي مجلد؟|Which folder?
Réserves|التحفظات|Snags
Réserves / Tâches|التحفظات / المهام|Snags / Tasks
Tâches|المهام|Tasks
Toutes les tâches sur les plans|كل المهام على التصاميم|All tasks on plans
En retard|متأخرة|Late
Ouvertes|مفتوحة|Open
Ouvert|مفتوح|Open
En cours|في طور الإنجاز|In progress
Levées (terminées)|مرفوعة (منتهية)|Cleared (done)
Vérifiées|تم التحقق|Verified
Vérifié|تم التحقق|Verified
Terminé|منتهي|Done
À lever|للرفع|To clear
Non levées (ouvertes + en cours)|غير مرفوعة (مفتوحة + جارية)|Not cleared (open + in progress)
Supprimer cette tâche ?|حذف هذه المهمة؟|Delete this task?
Supprimer la tâche|حذف المهمة|Delete task
Priorité|الأولوية|Priority
Critique|حرجة|Critical
Majeure|كبيرة|Major
Mineure|صغيرة|Minor
Normal|عادي|Normal
Statut|الحالة|Status
État|الحالة|Status
Échéance dépassée — touchez pour voir|تجاوز الأجل — المس للعرض|Overdue — tap to view
Entreprise|المقاولة|Company
Entreprise (lot)|المقاولة (الحصة)|Company (lot)
Entreprise / lot|المقاولة / الحصة|Company / lot
Entreprises / lots|المقاولات / الحصص|Companies / lots
Toutes entreprises|كل المقاولات|All companies
Toutes les entreprises|كل المقاولات|All companies
Sans entreprise|بدون مقاولة|No company
Nom de l'entreprise|اسم المقاولة|Company name
Intervenants|المتدخلون|Stakeholders
Intervenant|متدخل|Stakeholder
Équipe|الفريق|Team
Responsable|المسؤول|Manager
Réception & Bétonnage|الاستلام والصب|Reception & Concreting
Réception ferraillage|استلام الحديد|Rebar reception
Réception coffrage|استلام الكوفراج|Formwork reception
Réception ferraillage seule|استلام الحديد فقط|Rebar reception only
Programme de bétonnage|برنامج الصب|Concreting schedule
Programme de bétonnage seul|برنامج الصب فقط|Concreting schedule only
Réception + Bétonnage (un seul message)|الاستلام + الصب (رسالة واحدة)|Reception + Concreting (one message)
Réceptionné|مستلم|Received
Non réceptionné|غير مستلم|Not received
Réceptionné avec|مستلم مع|Received with
Avec réserve|بتحفظ|With reservation
Conforme|مطابق|Compliant
Non conf.|غير مطابق|Non-comp.
Manquant|ناقص|Missing
Bétonné|مصبوب|Concreted
Non bétonné|غير مصبوب|Not concreted
Tableaux par jour|الجداول حسب اليوم|Tables by day
Aucun tableau|لا يوجد جدول|No table
Aucun tableau pour le moment.|لا يوجد جدول حالياً.|No table yet.
Date du tableau|تاريخ الجدول|Table date
Supprimer ce tableau|حذف هذا الجدول|Delete this table
Supprimer ce tableau ?|حذف هذا الجدول؟|Delete this table?
PDF du tableau|PDF الجدول|Table PDF
Texte WhatsApp (tout le tableau)|نص واتساب (كل الجدول)|WhatsApp text (whole table)
Coller un texte|لصق نص|Paste text
Collez le message (WhatsApp, notes…) — une ligne par ouvrage|الصق الرسالة (واتساب، ملاحظات…) — سطر لكل منشأة|Paste the message (WhatsApp, notes…) — one line per element
Aucun ouvrage reconnu|لم يتم التعرف على أي منشأة|No element recognized
Ajouter et ligne suivante|إضافة والسطر التالي|Add and next line
Supprimer cette ligne ?|حذف هذا السطر؟|Delete this line?
Appui long sur une ligne pour la déplacer|ضغطة طويلة على السطر لنقله|Long press a line to move it
Quel jour ?|أي يوم؟|Which day?
Une date passée…|تاريخ سابق…|A past date…
Choisir la date|اختيار التاريخ|Pick date
Changer la date|تغيير التاريخ|Change date
Aujourd'hui|اليوم|Today
Date|التاريخ|Date
PV|محضر|Report
PV reçu|تم استلام المحضر|Report received
PV manquant|محضر ناقص|Missing report
PV marqué reçu|تم تأشير المحضر كمستلم|Report marked received
PV marqués reçus|تم تأشير المحاضر كمستلمة|Reports marked received
PV à récupérer ›|محاضر للاسترجاع ›|Reports to collect ›
Tous les PV ont été reçus 👍|تم استلام جميع المحاضر 👍|All reports received 👍
Touchez pour voir la liste et cocher les PV reçus|المس لعرض القائمة وتأشير المحاضر المستلمة|Tap to see the list and tick received reports
Voir et cocher|عرض وتأشير|View and tick
Retirer ce PV ?|إزالة هذا المحضر؟|Remove this report?
Générer le PV (PDF)|إنشاء المحضر (PDF)|Generate report (PDF)
Création du PV…|جارٍ إنشاء المحضر…|Creating report…
Reçu|مستلم|Received
Ouvrage|المنشأة|Element
Élément|العنصر|Element
Niveau|المستوى|Level
Zone|المنطقة|Zone
Localisation|الموقع|Location
Observation|ملاحظة|Observation
Observations|ملاحظات|Observations
Commentaire|تعليق|Comment
Description|الوصف|Description
Note|ملاحظة|Note
Notes|ملاحظات|Notes
Nouvelle note|ملاحظة جديدة|New note
Modifier la note|تعديل الملاحظة|Edit note
Photos|الصور|Photos
Aucune photo.|لا توجد صور.|No photos.
Ajouter des photos|إضافة صور|Add photos
Prendre une photo|التقاط صورة|Take a photo
Choisir dans la galerie|اختيار من المعرض|Pick from gallery
Photo (caméra / galerie)|صورة (كاميرا / معرض)|Photo (camera / gallery)
Supprimer cette photo ?|حذف هذه الصورة؟|Delete this photo?
Croquis|رسم توضيحي|Sketch
Supprimer le croquis ?|حذف الرسم؟|Delete sketch?
Tableau de dessin|لوحة الرسم|Drawing board
Nouveau dessin|رسم جديد|New drawing
Enregistrer le dessin|حفظ الرسم|Save drawing
Dessin enregistré ✓|تم حفظ الرسم ✓|Drawing saved ✓
Supprimer ce dessin|حذف هذا الرسم|Delete this drawing
Supprimer ce dessin ?|حذف هذا الرسم؟|Delete this drawing?
Colorier|تلوين|Fill
Stylo|قلم|Pen
Ligne|خط|Line
Flèche|سهم|Arrow
Cadre|إطار|Frame
Cercle|دائرة|Circle
Texte|نص|Text
Gomme|ممحاة|Eraser
Fond|الخلفية|Background
Blanc|أبيض|White
Quadrillé|مربعات|Grid
Points|نقاط|Dots
Un plan du projet|تصميم من المشروع|A project plan
Choisir le plan|اختيار التصميم|Choose plan
Quitter sans enregistrer ?|الخروج دون حفظ؟|Leave without saving?
Trait continu|خط متصل|Solid line
Tirets|خط متقطع|Dashed
Pointillés|خط منقط|Dotted
Constats|المعاينات|Findings
Constats / NC|المعاينات / عدم المطابقة|Findings / NC
Aucun constat.|لا توجد معاينة.|No findings.
Constat de non-conformité|معاينة عدم المطابقة|Non-conformity report
Constat / problème|المعاينة / المشكل|Finding / issue
Solution|الحل|Solution
Supprimer ce constat|حذف هذه المعاينة|Delete this finding
Supprimer ce constat ?|حذف هذه المعاينة؟|Delete this finding?
Non-conformités avec photo, problème et solution|عدم المطابقة مع صورة، مشكل وحل|Non-conformities with photo, issue and solution
Rapports PDF|تقارير PDF|PDF reports
Rapport PDF|تقرير PDF|PDF report
Rapport|تقرير|Report
Aucun rapport.|لا يوجد تقرير.|No report.
Supprimer ce rapport ?|حذف هذا التقرير؟|Delete this report?
Supprimer le rapport|حذف التقرير|Delete report
Rapports journaliers|التقارير اليومية|Daily reports
Suivi quotidien du chantier|التتبع اليومي للورش|Daily site follow-up
Création du rapport…|جارٍ إنشاء التقرير…|Creating report…
Préparation du rapport…|جارٍ تحضير التقرير…|Preparing report…
Rapport PDF des réserves|تقرير PDF للتحفظات|Snags PDF report
Rapport PDF de l'entreprise|تقرير PDF للمقاولة|Company PDF report
Générer le PDF|إنشاء PDF|Generate PDF
Création du PDF…|جارٍ إنشاء PDF…|Creating PDF…
Travaux réalisés|الأشغال المنجزة|Work done
Problèmes / observations|المشاكل / الملاحظات|Issues / observations
Effectif (ouvriers)|عدد العمال|Workforce
Engins / matériel|الآليات / المعدات|Machinery / equipment
Livraisons|التسليمات|Deliveries
Température (°C)|الحرارة (°م)|Temperature (°C)
Rédigé par|حرره|Written by
Formulaires|الاستمارات|Forms
Aucun formulaire.|لا توجد استمارة.|No forms.
Nouveau formulaire|استمارة جديدة|New form
Supprimer ce formulaire ?|حذف هذه الاستمارة؟|Delete this form?
Fiches de contrôle qualité|بطاقات مراقبة الجودة|Quality control sheets
Point de contrôle|نقطة المراقبة|Checkpoint
Contrôlé par|راقبه|Checked by
Signature du contrôleur|توقيع المراقب|Inspector signature
Signature de l'entreprise|توقيع المقاولة|Company signature
Signez dans le cadre|وقّع داخل الإطار|Sign in the box
Tableau de bord|لوحة القيادة|Dashboard
Avancement par entreprise|التقدم حسب المقاولة|Progress by company
Activité récente|النشاط الأخير|Recent activity
Calculs & Topo|الحسابات والطوبوغرافيا|Calculations & Survey
Outils de chantier — résultats enregistrés dans le projet|أدوات الورش — النتائج محفوظة في المشروع|Site tools — results saved in the project
Volume de béton (m³)|حجم الخرسانة (م³)|Concrete volume (m³)
Volume béton|حجم الخرسانة|Concrete volume
Surface coffrage|مساحة الكوفراج|Formwork area
Poids total acier|الوزن الإجمالي للحديد|Total steel weight
Poids par mètre|الوزن في المتر|Weight per meter
Surface|المساحة|Area
Périmètre|المحيط|Perimeter
Hauteur|الارتفاع|Height
Épaisseur|السمك|Thickness
Longueur (m)|الطول (م)|Length (m)
Hauteur (m)|الارتفاع (م)|Height (m)
Distance|المسافة|Distance
Pente|الميل|Slope
Altitude|الارتفاع|Elevation
Station|المحطة|Station
Point|نقطة|Point
Implantation|التخطيط|Setting out
Total|المجموع|Total
Ciment|الإسمنت|Cement
Sable|الرمل|Sand
Gravier|الحصى|Gravel
Eau|الماء|Water
Toupies|الشاحنات الخلاطة|Mixer trucks
Modèles 3D|النماذج ثلاثية الأبعاد|3D models
Modèle 3D|نموذج ثلاثي الأبعاد|3D model
Nouveau modèle 3D|نموذج ثلاثي الأبعاد جديد|New 3D model
Aucun modèle 3D.|لا يوجد نموذج ثلاثي الأبعاد.|No 3D model.
Coffrage tracé sur plan · ferraillage depuis la nomenclature|كوفراج مرسوم على التصميم · حديد من جدول القضبان|Formwork traced on plan · rebar from schedule
Coffrage — tracer sur un plan|كوفراج — الرسم على تصميم|Formwork — trace on a plan
Coffrage — dimensions (rectangle)|كوفراج — الأبعاد (مستطيل)|Formwork — dimensions (rectangle)
Coffrage — dimensions|كوفراج — الأبعاد|Formwork — dimensions
Ferraillage — lire la nomenclature du plan PDF|الحديد — قراءة جدول القضبان من PDF|Rebar — read the bar schedule from PDF
Ferraillage — saisie manuelle|الحديد — إدخال يدوي|Rebar — manual entry
Ferraillage détaillé par élément (semelle, poteau, poutre, dalle, voile)|حديد مفصل حسب العنصر (قاعدة، عمود، جائز، بلاطة، جدار)|Detailed rebar by element (footing, column, beam, slab, wall)
Plan AutoCAD (DXF) — parties d'ouvrage colorées par état|تصميم أوتوكاد (DXF) — أجزاء ملونة حسب الحالة|AutoCAD plan (DXF) — parts colored by status
Ferraillage|التسليح (الحديد)|Reinforcement
Coffrage|الكوفراج|Formwork
Créer en 3D|إنشاء 3D|Create in 3D
Quel élément ?|أي عنصر؟|Which element?
Quel plan ?|أي تصميم؟|Which plan?
Quel état ?|أي حالة؟|Which status?
Quelles barres ?|أي قضبان؟|Which bars?
Non commencé|لم يبدأ|Not started
Coffré|مكفرج|Formed
Coulé|مصبوب|Poured
Couleurs des états|ألوان الحالات|Status colors
Dessus|من فوق|Top
Face|أمامي|Front
Semelle isolée|قاعدة منفردة|Isolated footing
Poteau|عمود|Column
Poutre|جائز|Beam
Dalle|بلاطة|Slab
Voile|جدار خرساني|Wall
Nappe inférieure X|الشبكة السفلية X|Bottom mesh X
Nappe inférieure Y|الشبكة السفلية Y|Bottom mesh Y
Nappe supérieure X|الشبكة العلوية X|Top mesh X
Nappe supérieure Y|الشبكة العلوية Y|Top mesh Y
Attentes poteau|انتظارات العمود|Column starter bars
Cadres d'attente|إطارات الانتظار|Starter stirrups
Barres longitudinales|القضبان الطولية|Longitudinal bars
Cadres|الإطارات (الكادرات)|Stirrups
Épingles|الدبابيس|Pins
Filantes inférieures|القضبان السفلية|Bottom bars
Filantes supérieures|القضبان العلوية|Top bars
Chapeaux appui gauche|قبعات المسند الأيسر|Left support top bars
Chapeaux appui droit|قبعات المسند الأيمن|Right support top bars
Verticales face 1|عمودية الوجه 1|Verticals face 1
Verticales face 2|عمودية الوجه 2|Verticals face 2
Horizontales face 1|أفقية الوجه 1|Horizontals face 1
Horizontales face 2|أفقية الوجه 2|Horizontals face 2
Barre façonnée (dessin)|قضيب مشكّل (رسم)|Shaped bar (drawing)
Ajouter des barres|إضافة قضبان|Add bars
Voir en 3D|عرض 3D|View in 3D
Modifier les barres et dimensions|تعديل القضبان والأبعاد|Edit bars and dimensions
Nomenclature (repères)|جدول القضبان|Bar schedule
Forme de la barre|شكل القضيب|Bar shape
Dessiner une barre|رسم قضيب|Draw a bar
Dessinez d'abord la barre|ارسم القضيب أولاً|Draw the bar first
L développée|الطول المفرود|Developed length
Barre façonnée|قضيب مشكّل|Shaped bar
Nombre de barres|عدد القضبان|Number of bars
Libre|حر|Free
Enrobage (cm)|التغطية (سم)|Cover (cm)
Plan AutoCAD|تصميم أوتوكاد|AutoCAD plan
Unité du dessin|وحدة الرسم|Drawing unit
Millimètres|ملمتر|Millimeters
Centimètres|سنتيمتر|Centimeters
Mètres|متر|Meters
Sélectionner|تحديد|Select
Tracer|رسم|Trace
Partie d'ouvrage|جزء من المنشأة|Element part
Touchez une partie pour changer son état|المس جزءاً لتغيير حالته|Tap a part to change its status
Créer le ferraillage de cette partie|إنشاء حديد هذا الجزء|Create rebar for this part
Supprimer la zone|حذف المنطقة|Delete zone
Supprimer cette zone ?|حذف هذه المنطقة؟|Delete this zone?
Renommer / hauteur|إعادة التسمية / الارتفاع|Rename / height
Aucun contour fermé ici — utilisez ✎ Tracer|لا يوجد محيط مغلق هنا — استعمل ✎ رسم|No closed outline here — use ✎ Trace
Ouverture du plan AutoCAD…|جارٍ فتح تصميم أوتوكاد…|Opening AutoCAD plan…
Lecture du plan AutoCAD…|جارٍ قراءة تصميم أوتوكاد…|Reading AutoCAD plan…
Calques (toucher pour masquer / afficher)|الطبقات (المس للإخفاء / الإظهار)|Layers (tap to hide / show)
Supprimer ce modèle 3D ?|حذف هذا النموذج؟|Delete this 3D model?
Maquette 3D|المجسم ثلاثي الأبعاد|3D mockup
Ajouter une maquette 3D|إضافة مجسم ثلاثي الأبعاد|Add a 3D mockup
Aucune maquette liée.|لا يوجد مجسم مرتبط.|No linked mockup.
Chargement de la maquette…|جارٍ تحميل المجسم…|Loading mockup…
Outils|الأدوات|Tools
Outils PDF|أدوات PDF|PDF tools
Outils PDF (fusionner, diviser, pages)|أدوات PDF (دمج، تقسيم، صفحات)|PDF tools (merge, split, pages)
Fusionner, diviser, modifier des pages|دمج، تقسيم، تعديل الصفحات|Merge, split, edit pages
fusionner · diviser|دمج · تقسيم|merge · split
façonnage|تشكيل|bending
Extraire la sélection en un PDF|استخراج التحديد في PDF|Extract selection to a PDF
Un PDF par page|PDF لكل صفحة|One PDF per page
Page remplacée ✓|تم استبدال الصفحة ✓|Page replaced ✓
Rappels|التذكيرات|Reminders
Rappel|تذكير|Reminder
Aucun rappel|لا يوجد تذكير|No reminder
Rappel terminé ✓|تم إنهاء التذكير ✓|Reminder done ✓
Heure — sonnerie sur le téléphone (optionnel)|الساعة — رنين على الهاتف (اختياري)|Time — phone alarm (optional)
Liens rapides (Drive)|روابط سريعة (درايف)|Quick links (Drive)
Ajouter un lien|إضافة رابط|Add a link
Lien|رابط|Link
Lien Drive|رابط درايف|Drive link
Lien Google Drive|رابط جوجل درايف|Google Drive link
Dossier Drive|مجلد درايف|Drive folder
Dossier Google Drive|مجلد جوجل درايف|Google Drive folder
Lien du dossier Drive|رابط مجلد درايف|Drive folder link
Ouvrir le lien Drive|فتح رابط درايف|Open Drive link
Modifier le lien|تعديل الرابط|Edit link
Supprimer le lien|حذف الرابط|Delete link
Supprimer ce lien ?|حذف هذا الرابط؟|Delete this link?
Nom du lien|اسم الرابط|Link name
Google Drive|جوجل درايف|Google Drive
Google Drive connecté|جوجل درايف متصل|Google Drive connected
☁ Google Drive connecté ✓|☁ جوجل درايف متصل ✓|☁ Google Drive connected ✓
Connecter Google Drive|ربط جوجل درايف|Connect Google Drive
Connexion à Google Drive…|جارٍ الاتصال بجوجل درايف…|Connecting to Google Drive…
Synchronisation Google Drive|مزامنة جوجل درايف|Google Drive sync
Non connecté|غير متصل|Not connected
Déconnecté|منقطع|Disconnected
Déconnecter cet appareil|فصل هذا الجهاز|Disconnect this device
Code de connexion|رمز الاتصال|Connection code
J'ai un code|عندي رمز|I have a code
Première fois|أول مرة|First time
Code copié ✓|تم نسخ الرمز ✓|Code copied ✓
Téléchargement depuis Drive…|جارٍ التحميل من درايف…|Downloading from Drive…
Restaurer une sauvegarde|استرجاع نسخة احتياطية|Restore a backup
Sauvegarde manuelle (fichier)|نسخة احتياطية يدوية (ملف)|Manual backup (file)
Projet restauré ✓|تم استرجاع المشروع ✓|Project restored ✓
Restauration…|جارٍ الاسترجاع…|Restoring…
Paramètres|الإعدادات|Settings
Mon prénom|اسمي|My first name
Votre prénom|اسمك|Your first name
Comment vous appeler ?|بماذا نناديك؟|What should we call you?
Langue|اللغة|Language
Moi|أنا|Me
Nom|الاسم|Name
Nom (optionnel)|الاسم (اختياري)|Name (optional)
Titre|العنوان|Title
Type|النوع|Type
Catégorie|الفئة|Category
Autre|آخر|Other
Taille|الحجم|Size
Petit|صغير|Small
Grand|كبير|Large
Filtres|المرشحات|Filters
Toute la période|كل الفترة|Whole period
7 derniers jours|آخر 7 أيام|Last 7 days
30 derniers jours|آخر 30 يوماً|Last 30 days
Rien ici.|لا شيء هنا.|Nothing here.
Aucun chantier pour le moment|لا يوجد ورش حالياً|No site yet
Retard|تأخر|Delay
Téléphone|الهاتف|Phone
Destinataire|المرسل إليه|Recipient
Ouvrir dans l'application|فتح في التطبيق|Open in the app
Ouvrir dans le navigateur|فتح في المتصفح|Open in browser
Ouvrir avec une autre application|فتح بتطبيق آخر|Open with another app
Fichier du téléphone (PDF / image)|ملف من الهاتف (PDF / صورة)|Phone file (PDF / image)
Depuis le téléphone (PDF / image)|من الهاتف (PDF / صورة)|From phone (PDF / image)
Depuis Google Drive (lien)|من جوجل درايف (رابط)|From Google Drive (link)
Importer depuis Google Drive (lien)|استيراد من جوجل درايف (رابط)|Import from Google Drive (link)
Bonjour|صباح الخير|Good morning
Bon après-midi|مساء الخير|Good afternoon
Bonsoir|مساء الخير|Good evening
Bonne nuit|ليلة سعيدة|Good night
Rappels à faire|تذكيرات للقيام بها|Reminders to do
à faire|للقيام|to do
Bétonnage|الصب|Concreting
Réception|الاستلام|Reception
Version|الإصدار|Version
7 jours|7 أيام|7 days
Réserves ouvertes|التحفظات المفتوحة|Open snags
Mes chantiers|أوراشي|My sites
Fermer l'application|إغلاق التطبيق|Close the app
Synchroniser|مزامنة|Sync
Rechercher|بحث|Search
Réglages|الإعدادات|Settings
Équipe|الفريق|Team
Dossiers|المجلدات|Folders
Bonne journée sur le chantier ☀️|يوم موفق في الورش ☀️|Have a good day on site ☀️
Prêt pour les réceptions du jour ?|مستعد لاستلامات اليوم؟|Ready for today's inspections?
Un café, et on attaque 💪|قهوة، ونبداو 💪|A coffee, and let's go 💪
Nouvelle journée, nouveaux niveaux 🏗️|يوم جديد، طوابق جديدة 🏗️|New day, new levels 🏗️
La qualité commence dès le matin ✅|الجودة تبدأ من الصباح ✅|Quality starts in the morning ✅
Bon courage pour l'après-midi 💪|بالتوفيق هاد العشية 💪|Keep it up this afternoon 💪
Pensez aux PV de la matinée 📋|فكر في محاضر الصباح 📋|Think about this morning's reports 📋
Le bétonnage avance ? 🏗️|الصب كيتقدم؟ 🏗️|Is the concreting progressing? 🏗️
Encore un effort, la journée avance bien|شوية ديال الجهد، النهار غادي مزيان|One more push, the day is going well
Un point sur les réserves ?|نظرة على التحفظات؟|A look at the snags?
Belle soirée, bon travail aujourd'hui 👏|أمسية سعيدة، خدمة مزيانة اليوم 👏|Nice evening, good work today 👏
Le temps de faire le bilan du jour 📊|وقت حصيلة اليوم 📊|Time for today's summary 📊
Pensez à envoyer les tableaux du jour 📤|ما تنساش ترسل جداول اليوم 📤|Remember to send today's tables 📤
Reposez-vous, demain on continue 🌙|ارتاح، غدا نكملو 🌙|Rest, we continue tomorrow 🌙
Merci pour cette journée de chantier|شكراً على هاد النهار ديال الورش|Thanks for this day on site
`;
function i18nBuild() {
  const col = Lang.cur === 'ar' ? 1 : 2, map = new Map();
  I18N_DATA.split('\n').forEach(l => { const p = l.split('|'); if (p.length === 3 && p[col]) map.set(p[0].trim(), p[col].trim()); });
  return map;
}
// traduit un libellé (exact, ou avec ponctuation / flèche / compteur autour)
function tr(s) {
  if (!Lang.map || !s) return s;
  const t = s.trim(); if (!t) return s;
  let v = Lang.map.get(t);
  if (!v) { const m = t.match(/^(.*?)(\s*(?:›|:|…|\?|✓))$/); if (m && Lang.map.get(m[1])) v = Lang.map.get(m[1]) + m[2]; }
  if (!v) { const m = t.match(/^(\d+)\s+(.+)$/); if (m && Lang.map.get(m[2])) v = m[1] + ' ' + Lang.map.get(m[2]); }
  if (!v) { const m = t.match(/^(\d+) rappel\(s\)$/); if (m) v = m[1] + (Lang.cur === 'ar' ? ' تذكير' : ' reminder(s)'); }
  if (!v) { const m = t.match(/^([^\p{L}\d]*)(.*?)([^\p{L}\d]*)$/u); if (m && m[2] && m[2] !== t) { const inner = tr(m[2]); if (inner !== m[2]) v = m[1] + inner + m[3]; } }
  if (!v) { const m = t.match(/^(.+?),\s*(.+)$/); if (m && /^(Bonjour|Bon après-midi|Bonsoir|Bonne nuit)$/.test(m[1])) v = Lang.map.get(m[1]) + '، ' + m[2]; }
  return v ? s.replace(t, v) : s;
}
function i18nNode(root) {
  if (!Lang.map) return;
  if (root.nodeType === 3) { const p = root.parentNode; if (p && !/^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName) && !(p.closest && p.closest('.notr'))) { const v = tr(root.data); if (v !== root.data) root.data = v; } return; }
  if (root.nodeType !== 1) return;
  if (/^(SCRIPT|STYLE|TEXTAREA|svg)$/i.test(root.nodeName) || root.classList.contains('notr')) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  const els = [root];
  for (let n = w.nextNode(); n; n = w.nextNode()) { if (n.nodeType === 1) els.push(n); else i18nNode(n); }
  els.forEach(e => { if (e.placeholder) { const v = tr(e.placeholder); if (v !== e.placeholder) e.placeholder = v; } if (e.title && e.nodeName !== 'svg') { const v = tr(e.title); if (v !== e.title) e.title = v; } });
}
function i18nStart() {
  if (Lang.cur === 'fr') return;
  Lang.map = Lang.map || i18nBuild();
  document.documentElement.lang = Lang.cur; document.documentElement.classList.add('lang-' + Lang.cur);
  i18nNode(document.body);
  new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') i18nNode(m.target); else m.addedNodes.forEach(i18nNode); } })
    .observe(document.body, { childList: true, subtree: true, characterData: true });
}
async function chooseLang() {
  const v = await menu('Langue · اللغة · Language', LANGS.map(([k, l]) => ({ label: l, icon: 'globe', value: k, checked: k === Lang.cur })));
  if (!v || v === Lang.cur) return;
  try { localStorage.setItem('lang', v); } catch (e) {}
  location.reload();
}
if (Lang.cur !== 'fr') Lang.map = i18nBuild();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', i18nStart); else i18nStart();
