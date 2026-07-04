// ============================================================================
//  AVATARES PREDISEÑADOS  —  All-Anime
//  Colección estilo Crunchyroll / Disney+.
// ============================================================================

export const AVATARS = [
  "https://prod-ripcut-delivery.disney-plus.net/v1/variant/disney/696F5403EE2E61A8D3F8CF6D3E7348CF24A0C6D5915CFE66CAC1C39CD6D280AA/scale?width=300&aspectRatio=1.00&format=png",
  "https://prod-ripcut-delivery.disney-plus.net/v1/variant/disney/155783B49B84879D5DC715BA374BC23210B3491AF3A241120E8818F87B06EEDA/scale?width=300&aspectRatio=1.00&format=png",
  "https://prod-ripcut-delivery.disney-plus.net/v1/variant/disney/FE49954B252C628EC809C68832E9137D5926C2085D58A6510F8BBA12933F7B7E/scale?width=300&aspectRatio=1.00&format=png",
  "https://prod-ripcut-delivery.disney-plus.net/v1/variant/disney/BA2B0A0DBDAED26E6546A7533238E3F41F811DD1D3B20DF41992D856C64D9CDB/scale?width=300&aspectRatio=1.00&format=png",
  "https://prod-ripcut-delivery.disney-plus.net/v1/variant/disney/912D34995E37BB375284B59F1849F76B9369556D3807BDCADFA8589758169FBA/scale?width=300&aspectRatio=1.00&format=png",
  "https://prod-ripcut-delivery.disney-plus.net/v1/variant/disney/1E411D9E4F152EFBFD34776503D50E855FBA69A89419EA7BD8784512D8F98C52/scale?width=300&aspectRatio=1.00&format=png",
  "https://prod-ripcut-delivery.disney-plus.net/v1/variant/disney/D220D10C0975FA55321E501DD97D0E68B76B74BF4A03750F403A1B1390F95ED1/scale?width=300&aspectRatio=1.00&format=png",
  "https://prod-ripcut-delivery.disney-plus.net/v1/variant/disney/96FC386614F19A7E916F8A44F3BE05CF87C638B27BC4F33E9A1D071D9B3B0030/scale?width=300&aspectRatio=1.00&format=png",
  "https://static.crunchyroll.com/assets/avatar/170x170/1056-black-clover-asta.png",
  "https://static.crunchyroll.com/assets/avatar/170x170/1057-black-clover-yuno.png",
  "https://static.crunchyroll.com/assets/avatar/170x170/1058-black-clover-noelle.png",
  "https://static.crunchyroll.com/assets/avatar/170x170/1059-black-clover-yami.png",
  "https://static.crunchyroll.com/assets/avatar/170x170/egghead-luffy.png",
  "https://static.crunchyroll.com/assets/avatar/170x170/egghead-nami.png",
  "https://static.crunchyroll.com/assets/avatar/170x170/egghead-sanji.png",
  "https://static.crunchyroll.com/assets/avatar/170x170/egghead-zoro.png",
  "https://static.crunchyroll.com/assets/avatar/170x170/01_heli_avatar.png",
  "https://static.crunchyroll.com/assets/avatar/170x170/02_jino_avatar.png",
  "https://static.crunchyroll.com/assets/avatar/170x170/1041-jujutsu-kaisen-yuji-itadori.png",
  "https://static.crunchyroll.com/assets/avatar/170x170/1042-jujutsu-kaisen-megumi-fushigoro.png",
  "https://static.crunchyroll.com/assets/avatar/170x170/1044-jujutsu-kaisen-satoru-gojo.png",
  "https://static.crunchyroll.com/assets/avatar/170x170/sololeveling_s2_avatar_2_v2_jinwoo_avatar.png",
  "https://static.crunchyroll.com/assets/avatar/170x170/100006-spy-x-family-loid.png",
  "https://static.crunchyroll.com/assets/avatar/170x170/100007-spy-x-family-yor.png",
  "https://static.crunchyroll.com/assets/avatar/170x170/100008-spy-x-family-anya-1.png",
  "https://static.crunchyroll.com/assets/avatar/170x170/chainsawman-pochita.png",
  "https://static.crunchyroll.com/assets/avatar/170x170/01_yuru_avatar.png",
];

// Avatar por defecto (elegido de forma estable a partir del nombre/correo).
export function defaultAvatar(seed) {
  const s = String(seed || "all-anime");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATARS[h % AVATARS.length];
}
