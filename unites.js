/* Ajout : catégories dans l'ordre + unités (kg, L) */
const ORDRE = ["Viandes", "Sauces", "Frites et snacks", "Légumes", "Pains", "Courses", "Boîtes", "Sucre", "Boissons", "Produits nettoyants"];


const unite = p => {
  if (p.unite && p.unite !== "unités") return p.unite;
  const n = (p.nom || "").trim().toLowerCase();
  return n === "poulet" || n === "merguez" ? "kg" : n === "huile" ? "L" : "";
};
const st = document.createElement("style");
st.textContent = "select{width:100%;padding:13px 14px;border:1.5px solid var(--line);border-radius:10px;background:var(--card);margin:0 0 10px;font:inherit;color:inherit}";
document.head.append(st);

vueListe = function () {
  const cats = {};
  items.forEach(p => (cats[p.categorie || "Autres"] ||= []).push(p));
  const noms = Object.keys(cats).sort((a, b) => {
    const i = ORDRE.indexOf(a), j = ORDRE.indexOf(b);
    return (i < 0 ? 99 : i) - (j < 0 ? 99 : j);
  });
  const nb = items.filter(p => p.besoin).length;
  const blocs = [h("h1", {}, "Il manque quoi ?"), h("p", { class: "sub" }, "Salut " + nom + ". Coche ce qui est presque fini.")];
  if (!items.length) blocs.push(h("p", { class: "sub" }, "Aucun produit pour l'instant. Le gérant doit d'abord en ajouter."));
  for (const cat of noms) {
    blocs.push(h("h2", {}, cat));
    cats[cat].forEach(p => {
      const u = unite(p);
      const cb = h("input", { type: "checkbox", checked: p.besoin, onchange: async () => {
        await maj(p, cb.checked, 1, ""); vueListe();
      } });
      blocs.push(h("div", { class: "row" + (p.besoin ? " on" : "") }, h("label", {}, cb, p.nom)));
      if (p.besoin) {
        const note = h("input", { type: "text", placeholder: "Précision (facultatif)", value: p.note, maxLength: 120,
          onchange: () => maj(p, true, p.qte, note.value) });
        blocs.push(h("div", { class: "det" },
          h("div", { class: "qty" },
            h("button", { class: "alt", "aria-label": "Moins", onclick: async () => { if (p.qte > 1) { await maj(p, true, p.qte - 1, p.note); vueListe(); } } }, "−"),
            h("b", { style: "min-width:60px" }, p.qte + (u ? " " + u : "")),
            h("button", { class: "alt", "aria-label": "Plus", onclick: async () => { if (p.qte < 99) { await maj(p, true, p.qte + 1, p.note); vueListe(); } } }, "+")),
          note));
      }
    });
  }
  blocs.push(h("div", {}, h("button", { class: "link", onclick: () => { store.set("code", ""); code = ""; vueLogin(); } }, "Changer de personne")));
  const send = h("button", { class: "main", onclick: async () => {
    send.disabled = true;
    const { data, error } = await sb.rpc("courses_envoyer", { p_code: code, p_nom: nom });
    send.disabled = false;
    if (error) return toast(error.message.includes("patiente") ? "Patiente 30 secondes avant de renvoyer." : "Erreur : " + error.message);
    toast(data ? data + " produit(s) envoyé(s) au gérant." : "Rien n'est coché.");
  } }, nb ? "Envoyer au gérant (" + nb + ")" : "Envoyer au gérant");
  blocs.push(h("div", { class: "bar" }, send));
  show(...blocs);
};

vueAdmin = async function () {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return vueAdminLogin();
  const { data, error } = await sb.from("courses_produits").select("*").order("categorie").order("nom");
  if (error) { toast("Accès refusé : ce compte n'est pas gérant."); return vueAdminLogin(); }
  const nomI = h("input", { type: "text", placeholder: "Produit (ex : Beurre)" });
  const catI = h("select", {}, ...ORDRE.map(c => h("option", { value: c }, c)));
  const add = h("button", { onclick: async () => {
    if (!nomI.value.trim()) return toast("Écris le nom du produit.");
    const { error } = await sb.from("courses_produits").insert({ nom: nomI.value.trim(), categorie: catI.value });
    if (error) return toast("Erreur : " + error.message);
    vueAdmin();
  } }, "Ajouter le produit");
  const blocs = [h("h1", {}, "Espace gérant"), h("p", { class: "sub" }, "Gère ta liste de produits."), nomI, catI, add];
  const aAcheter = data.filter(p => p.besoin);
  blocs.push(h("h2", {}, "À acheter (" + aAcheter.length + ")"));
  if (!aAcheter.length) blocs.push(h("p", { class: "sub" }, "Rien à acheter pour le moment."));
  aAcheter.forEach(p => {
    const u = unite(p);
    blocs.push(h("div", { class: "row on" },
      h("span", { style: "flex:1" }, p.nom + " ×" + p.qte + (u ? " " + u : "") + (p.note ? " (" + p.note + ")" : "") + (p.demande_par ? " — " + p.demande_par : "")),
      h("button", { class: "alt", onclick: async () => {
        await sb.from("courses_produits").update({ besoin: false, qte: 0, note: "", demande_par: "", demande_le: null, achete_le: new Date().toISOString() }).eq("id", p.id);
        vueAdmin();
      } }, "Acheté")));
  });
  blocs.push(h("h2", {}, "Tous les produits (" + data.length + ")"));
  data.forEach(p => blocs.push(h("div", { class: "row" },
    h("span", { style: "flex:1" }, p.nom, h("small", { style: "color:var(--mute)" }, p.categorie ? "  · " + p.categorie : "")),
    h("button", { class: "del", onclick: async () => {
      if (!confirm("Supprimer " + p.nom + " ?")) return;
      await sb.from("courses_produits").delete().eq("id", p.id); vueAdmin();
    } }, "Supprimer"))));
  blocs.push(h("h2", {}, "Réglages"),
    h("div", { class: "two" },
      h("button", { class: "alt", onclick: async () => {
        const { error } = await sb.rpc("courses_test_notif");
        toast(error ? "Erreur : " + error.message : "Notification de test envoyée.");
      } }, "Tester la notif"),
      h("button", { class: "alt", onclick: async () => { await sb.auth.signOut(); vueAdminLogin(); } }, "Se déconnecter")),
    h("div", {}, h("button", { class: "link", onclick: () => { location.hash = ""; } }, "Retour à la page employés")));
  show(...blocs);
};
vueLogin = function () {
  code = "1234";
  const n = h("input", { type: "text", placeholder: "Ton prénom", value: nom, autocomplete: "given-name" });
  const go = async () => {
    if (!n.value.trim()) return toast("Entre ton prénom.");
    nom = n.value.trim();
    try { await charger(); store.set("code", code); store.set("nom", nom); vueListe(); }
    catch (e) { toast("Erreur de connexion."); }
  };
  show(
    h("img", { class: "logo", src: LOGO, alt: "" }),
    h("h1", {}, "The Place To B"),
    h("p", { class: "sub" }, "Entre ton prénom pour signaler les produits qui manquent."),
    n,
    h("button", { onclick: go }, "Entrer"),
    h("div", {}, h("button", { class: "link", onclick: () => { location.hash = "admin"; } }, "Espace gérant"))
  );
};

route();
