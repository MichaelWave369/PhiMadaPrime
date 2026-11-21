/**
 * R45 Muse public-key adapter, browser-local and read-only.
 *
 * Converts a PUBLIC Muse Ed25519 key (raw 32-byte base64url) to RFC 8410 SPKI
 * and the existing R45 operator-pin schema. No signatures are generated and
 * no private keys, seeds, mnemonic, authority, network calls or persistence.
 *
 * Muse key fingerprint = SHA-256(raw key bytes).
 * R45 key_id          = SHA-256(44-byte DER SPKI).
 * These are different fingerprints of the SAME public key.
 */
const SPKI_PREFIX=Uint8Array.from([
  0x30,0x2a,0x30,0x05,0x06,0x03,0x2b,0x65,0x70,0x03,0x21,0x00
]);
const ID=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;
const REPO=/^MichaelWave369\/(?!\.{1,2}$)[A-Za-z0-9_.-]{1,100}$/i;
const FINGERPRINT=/^sha256:[a-f0-9]{64}$/;

function hex(value){
  return [...new Uint8Array(value)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function encoded(bytes){
  let binary="";
  for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
}

export function decodeMuseEd25519PublicKey(input){
  if(typeof input!=="string"||input.length>128)
    throw Error("Expected only a public Muse Ed25519 key");
  const value=input.trim().replace(/^ed25519:/,"");
  // Exactly 32 raw bytes, canonical unpadded base64url (not PEM or a seed).
  if(!/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(value))
    throw Error("Muse public key must be 32 bytes in unpadded base64url");
  let bytes;
  try {
    const canonical=value.replaceAll("-","+").replaceAll("_","/")+"=";
    bytes=Uint8Array.from(atob(canonical),ch=>ch.charCodeAt(0));
  } catch {
    throw Error("Malformed Muse public key encoding");
  }
  if(bytes.length!==32||encoded(bytes)!==value)
    throw Error("Noncanonical Muse public key encoding");
  return bytes;
}

export async function musePublicKeyToR45Pins({
  publicKey, museFingerprint, issuerId, repository,
  cryptoApi=globalThis.crypto
}={}){
  if(!ID.test(issuerId||""))throw Error("Invalid R45 issuer label");
  if(!REPO.test(repository||""))throw Error("R45 pin must target an explicit MichaelWave369 repository");
  if(!FINGERPRINT.test(museFingerprint||""))
    throw Error("Expected full lowercase Muse SHA-256 raw-key fingerprint");
  if(!cryptoApi?.subtle)throw Error("Web Crypto unavailable");
  const raw=decodeMuseEd25519PublicKey(publicKey);
  const spki=new Uint8Array(44);
  spki.set(SPKI_PREFIX,0);
  spki.set(raw,SPKI_PREFIX.length);
  const computedMuseFingerprint="sha256:"+hex(
    await cryptoApi.subtle.digest("SHA-256",raw));
  if(computedMuseFingerprint!==museFingerprint)
    throw Error("Muse public key and raw-key fingerprint do not match");
  const r45KeyId="sha256:"+hex(await cryptoApi.subtle.digest("SHA-256",spki));
  const pins={
    format:"phi.gmed.operator-pins.v1",
    keys:[{
      issuer_id:issuerId,
      key_id:r45KeyId,
      public_key_spki_base64:encoded(spki).replaceAll("-","+").replaceAll("_","/")+"=",
      repository,
      active:true
    }]
  };
  // Pin creation only establishes internal key consistency, never who owns it.
  return {
    museFingerprint:computedMuseFingerprint,
    r45KeyId,
    pinStore:pins,
    pinStoreJson:JSON.stringify(pins,null,2)+"\n",
    issuerIdentityAuthenticated:false,
    authorizationGranted:false
  };
}
