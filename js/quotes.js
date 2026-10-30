// Enseignements de Rabbi Nahman de Breslev, Sefer HaMidot (texte hébreu original, traduction française libre).
// Réf. : « Tsédaka I:16 » = Sefer HaMidot, צדקה, חלק ראשון, אות טז ; « Argent » = ממון.

export const QUOTES = [
  { t: 'tsedaka', he: 'כָּל פְּרוּטָה וּפְרוּטָה מִצְטָרְפִין לְחֶשְׁבּוֹן גָּדוֹל', fr: 'Chaque petite pièce s’ajoute aux autres pour former un grand compte.', ref: 'Tsédaka I:16' },
  { t: 'tsedaka', he: 'הַשִּׂמְחָה בִּצְדָקָה הִיא סִימָן עַל לֵב שָׁלֵם', fr: 'La joie dans la tsédaka est le signe d’un cœur entier.', ref: 'Tsédaka I:58' },
  { t: 'tsedaka', he: 'שְׁקוּלָה צְדָקָה כְּנֶגֶד כָּל הַמִּצְווֹת', fr: 'La tsédaka équivaut à toutes les mitsvot réunies.', ref: 'Tsédaka I:14' },
  { t: 'tsedaka', he: 'גְּדוֹלָה צְדָקָה שֶׁמְּקָרֶבֶת אֶת הַגְּאֻלָּה', fr: 'Grande est la tsédaka, car elle rapproche la Délivrance.', ref: 'Tsédaka I:2' },
  { t: 'tsedaka', he: 'וּמַצֶּלֶת מִן הַמִּיתָה', fr: 'La tsédaka sauve de la mort.', ref: 'Tsédaka I:3' },
  { t: 'tsedaka', he: 'וְנַעֲשֶׂה מַלְוֶה לְהַקָּדוֹשׁ בָּרוּךְ הוּא', fr: 'Celui qui donne devient comme un prêteur du Saint, béni soit-Il.', ref: 'Tsédaka I:5' },
  { t: 'tsedaka', he: 'גָּדוֹל הָעוֹשֶׂה צְדָקָה בַּסֵּתֶר יוֹתֵר מִמּשֶׁה', fr: 'Celui qui donne en secret est plus grand que Moïse.', ref: 'Tsédaka I:17' },
  { t: 'tsedaka', he: 'הַנּוֹתֵן פְּרוּטָה לֶעָנִי מִתְבָּרֵךְ בְּשֵׁשׁ, וְהַמְפַיְּסוֹ מִתְבָּרֵךְ בְּאַחַת עֶשְׂרֵה', fr: 'Qui donne une pièce au pauvre reçoit six bénédictions ; qui le réconforte par la parole en reçoit onze.', ref: 'Tsédaka I:18' },
  { t: 'tsedaka', he: 'יִתֵּן לִצְדָקָה בִּשְׁתֵּי יָדַיִם, וְיִהְיֶה תְּפִלָּתוֹ נִשְׁמַעַת', fr: 'Qu’il donne à deux mains, et sa prière sera entendue.', ref: 'Tsédaka I:27' },
  { t: 'tsedaka', he: 'עַל יְדֵי צְדָקָה בָּא אֱמוּנָה', fr: 'Par la tsédaka vient la foi.', ref: 'Tsédaka I:29' },
  { t: 'tsedaka', he: 'עַל יְדֵי צְדָקָה זוֹכֶה אָדָם לְחֵן', fr: 'Par la tsédaka, on gagne la grâce.', ref: 'Tsédaka I:38' },
  { t: 'tsedaka', he: 'מִי שֶׁמְּדַבֵּר לִבְנֵי אָדָם, שֶׁיִּתְּנוּ צְדָקָה, הוּא מַרְבֶּה יְשׁוּעָה', fr: 'Celui qui encourage les autres à donner multiplie le salut.', ref: 'Tsédaka I:39' },
  { t: 'tsedaka', he: 'עֲשֵׂה עַד שֶׁאַתָּה מוֹצֵא וּמָצוּי לְךָ וְעוֹדְךָ בְּיָדְךָ', fr: 'Agis tant que tu le peux, tant que tu en as les moyens et que c’est encore entre tes mains.', ref: 'Tsédaka I:59' },
  { t: 'tsedaka', he: 'אֲפִלּוּ עָנִי יִתֵּן צְדָקָה, וְאֵין מַרְאִין לוֹ סִימָנֵי עֲנִיּוּת', fr: 'Même le pauvre donnera la tsédaka, et on ne lui montrera plus de signes de pauvreté.', ref: 'Tsédaka I:70' },
  { t: 'maaser', he: 'גָּדוֹל כֹּחַ הַמַּעֲשֵׂר, שֶׁמְּהַפֵּךְ הַקְּלָלָה לִבְרָכָה', fr: 'Grande est la force du maasser : il change la malédiction en bénédiction.', ref: 'Tsédaka II:10' },
  { t: 'maaser', he: 'הַתּוֹרָה וְהַמַּעֲשֵׂר וְהַשַּׁבָּת הֵם נוֹתְנִים חַיִּים גַּשְׁמִיִּים גַם כֵּן', fr: 'La Torah, le maasser et le Chabbat donnent aussi la vie matérielle.', ref: 'Tsédaka II:2' },
  { t: 'maaser', he: 'הַמַּעֲשֵׂר מְסֻגָּל לַעֲשִׁירוּת דַּוְקָא בְּאֶרֶץ־יִשְׂרָאֵל', fr: 'Le maasser est une ségoula de richesse, tout particulièrement en Terre d’Israël.', ref: 'Argent I:33' },
  { t: 'maaser', he: 'עַל יְדֵי הַמָּמוֹן שֶׁנּוֹתֵן לַעֲנִיֵּי אֶרֶץ יִשְׂרָאֵל, עַל יְדֵי זֶה מָמוֹנוֹ נִתְקַיֵּם בְּיָדוֹ', fr: 'Par l’argent donné aux pauvres de la Terre d’Israël, son argent se maintient entre ses mains.', ref: 'Tsédaka II:17' },
  { t: 'maaser', he: 'כְּשֶׁרוֹאֶה אָדָם שֶׁמְּזוֹנוֹתָיו מְצֻמְצָמִין, יַעֲשֶׂה מֵהֶם צְדָקָה', fr: 'Quand on voit que sa subsistance est restreinte, qu’on en fasse de la tsédaka.', ref: 'Argent I:59' },
  { t: 'maaser', he: 'עַל־יְדֵי צְדָקָה זוֹכִין לְפַרְנָסָה', fr: 'Par la tsédaka, on mérite la subsistance.', ref: 'Argent I:86' },
  { t: 'maaser', he: 'עַל־יְדֵי צְדָקָה יִהְיֶה לְךָ הַרְחָבָה', fr: 'Par la tsédaka, tu connaîtras l’aisance.', ref: 'Argent I:90' },
  { t: 'maaser', he: 'הָעוֹסֵק בְּתוֹרָה וּבִצְדָקָה, זוֹכֶה לַעֲשִׁירוּת', fr: 'Celui qui s’attache à la Torah et à la tsédaka mérite la richesse.', ref: 'Argent I:92' },
  { t: 'joie', he: 'הַשִּׂמְחָה תְּמִידִית מְסֻגָּל לְהַצְלָחָה', fr: 'La joie constante est une ségoula de réussite.', ref: 'Argent I:47' },
  { t: 'joie', he: 'עַל־יְדֵי אֱמוּנָה נִתְרַבֶּה פַּרְנָסָה', fr: 'Par la foi, la subsistance se multiplie.', ref: 'Argent I:28' },
];

const dayIndex = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5);

// Citation du jour pour un thème ; `shift` permet de passer à la suivante.
export function quoteFor(topics, shift = 0) {
  const list = QUOTES.filter((q) => topics.includes(q.t));
  return list[(dayIndex() + shift) % list.length];
}
