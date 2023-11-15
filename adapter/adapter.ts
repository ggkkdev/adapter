import {
    privateKeyNegate,
    privateKeyTweakAdd,
    privateKeyTweakMul,
    publicKeyCombine, publicKeyConvert,
    publicKeyCreate,
    publicKeyTweakMul
} from "secp256k1";
import {randomBytesVerified} from "./utils";

const EC = require('elliptic').ec
const ec = new EC('secp256k1')
const ecparams = ec.curve
// Hack, we can not use bn.js@5, while elliptic uses bn.js@4
// See https://github.com/indutny/elliptic/issues/191#issuecomment-569888758
const BN = ecparams.n.constructor
const red = BN.red(ec.n);
const {ethers} = require("hardhat");


export interface IPresignOutput {
    R: Uint8Array,
    sAdapt: Uint8Array,
    e: Uint8Array,
    T: Uint8Array,
    t: Uint8Array
}

export default class SchnorrAdapter {
    static presign(m: Uint8Array, privateKey: Uint8Array, _T?: Uint8Array): IPresignOutput {
        const publicKey = publicKeyCreate(privateKey);
        const r = randomBytesVerified(32);
        const R = publicKeyCreate(r);
        // t used only if not T not provided
        const t = randomBytesVerified(32);
        const T = _T ? _T : publicKeyCreate(t);
        const RT = publicKeyCombine([R, T]);
        // e = h(address(R+T) || compressed pubkey || m)
        const e = this.challenge(RT, m, publicKey);

        // xe = x * e
        const xe = privateKeyTweakMul(privateKey, e);
        // s' = r + xe
        const sAdapt = privateKeyTweakAdd(xe, r);
        //        const sAdapt=BN(xe).toRed(red).add(BN(r).toRed(red)).toBuffer()
        return {R, T, t, sAdapt, e};
    }

    static verify(sAdapt: Uint8Array, R: Uint8Array, T: Uint8Array, publicKey: Uint8Array, m: Uint8Array) {
        const SAdapt = publicKeyCreate(sAdapt);
        const RT = publicKeyCombine([R, T]);
        // e = h(address(R+T) || compressed pubkey || m)
        const e = this.challenge(RT, m, publicKey);
        //R+e*publicKey
        const Xe = publicKeyTweakMul(publicKey, e);
        const SAdaptCheck = publicKeyCombine([Xe, R]);
        return ethers.hexlify(SAdaptCheck) == ethers.hexlify(SAdapt);
    }

    static adapt(sAdapt: Uint8Array, t: Uint8Array) {
        /*const s = privateKeyTweakAdd(sAdapt, t);
        const sAdaptn = privateKeyNegate(sAdapt);
        const trecover = privateKeyTweakAdd(s, sAdaptn);
         */
        const sAdaptBN = new BN(sAdapt).toRed(red)
        const s = sAdaptBN.redAdd(new BN(t).toRed(red));
        return s.toBuffer();
    }

    /**
     * TODO understand why privateKeyTweakAdd don't work
     * @param s:complete signature
     * @param sAdapt: adaptor signature
     */
    static recover(s: Uint8Array, sAdapt: Uint8Array) {
        /*const sAdaptMin = privateKeyNegate(sAdapt);
        return privateKeyTweakAdd(s, sAdaptMin);*/
        const sBN = new BN(s).toRed(red)
        const sAdaptBN = new BN(sAdapt).toRed(red)
        return sBN.redSub(sAdaptBN).toBuffer();
    }

    static challenge(R: Uint8Array, m: Uint8Array, publicKey: Uint8Array) {
        // convert R to address
        // see https://github.com/ethereum/go-ethereum/blob/eb948962704397bb861fd4c0591b5056456edd4d/crypto/crypto.go#L275
        const R_uncomp = publicKeyConvert(R, false);
        const R_addr = ethers.hexlify(ethers.getBytes(ethers.keccak256(R_uncomp.slice(1, 65))).slice(12, 32));

        // e = keccak256(address(R) || compressed publicKey || m)
        const e = ethers.getBytes(ethers.solidityPackedKeccak256(
            ["address", "uint8", "bytes32", "bytes32"],
            [R_addr, publicKey[0] + 27 - 2, publicKey.slice(1, 33), m]));
        return e;
    }
}

