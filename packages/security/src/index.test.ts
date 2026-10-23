import {describe,it,expect} from 'vitest';
import {base32,decodeBase32,hotp,verifyTotp,seal,unseal,recoveryDigest} from './index';
const reference=base32(Buffer.from('12345678901234567890'));
describe('RFC authenticator vectors',()=>{
 it.each([[0,'755224'],[1,'287082'],[2,'359152'],[3,'969429'],[4,'338314'],[5,'254676'],[6,'287922'],[7,'162583'],[8,'399871'],[9,'520489']])('matches RFC 4226 counter %s',(counter,expected)=>expect(hotp(reference,Number(counter))).toBe(expected));
 it.each([[59,'94287082'],[1111111109,'07081804'],[1111111111,'14050471'],[1234567890,'89005924'],[2000000000,'69279037'],[20000000000,'65353130']])('matches RFC 6238 SHA-1 time %s',(time,expected)=>expect(hotp(reference,Math.floor(Number(time)/30),8)).toBe(expected));
 it('round trips base32 without accepting non-alphabet characters',()=>{expect(decodeBase32(reference).toString()).toBe('12345678901234567890');expect(()=>decodeBase32('BAD-SECRET')).toThrow();});
 it('accepts a bounded time window and prevents replay',()=>{const now=1700000000000,counter=Math.floor(now/30000),code=hotp(reference,counter);expect(verifyTotp(reference,code,now)).toBe(counter);expect(verifyTotp(reference,code,now,counter)).toBeNull();expect(verifyTotp(reference,hotp(reference,counter-2),now)).toBeNull();expect(verifyTotp(reference,'invalid',now)).toBeNull();});
});
describe('authenticator secret storage',()=>{
 const key='a'.repeat(48);
 it('encrypts with fresh IVs and authenticates ciphertext',()=>{const first=seal(reference,key),second=seal(reference,key);expect(first).not.toContain(reference);expect(first).not.toBe(second);expect(unseal(first,key)).toBe(reference);expect(()=>unseal(first,'b'.repeat(48))).toThrow();const parts=first.split('.');parts[2]=(parts[2]!.startsWith('A')?'B':'A')+parts[2]!.slice(1);expect(()=>unseal(parts.join('.'),key)).toThrow();});
 it('normalises recovery code formatting without storing plaintext',()=>{expect(recoveryDigest('ABCD-EFGH',key)).toBe(recoveryDigest('abcd efgh',key));expect(recoveryDigest('ABCD-EFGH',key)).not.toContain('ABCD');});
});
