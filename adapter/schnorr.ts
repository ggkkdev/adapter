const {ethers} = require("hardhat");

const {randomBytes} = require('crypto')
const secp256k1 = require('secp256k1')


export default class Schnorr {
    static sign(m: Uint8Array, privateKey: Uint8Array) {
        const publicKey= secp256k1.publicKeyCreate(privateKey);
        // R = G * k
        const k = randomBytes(32);
        const R = secp256k1.publicKeyCreate(k);

        // e = h(address(R) || compressed pubkey || m)
        const e = this.challenge(R, m, publicKey);

        // xe = x * e
        const xe = secp256k1.privateKeyTweakMul(privateKey, e);

        // s = k + xe
        const s = secp256k1.privateKeyTweakAdd(k, xe);
        return {R, s, e};
    }

    static challenge(R: Uint8Array, m: Uint8Array, publicKey: Uint8Array) {
        // convert R to address
        // see https://github.com/ethereum/go-ethereum/blob/eb948962704397bb861fd4c0591b5056456edd4d/crypto/crypto.go#L275
        const R_uncomp = secp256k1.publicKeyConvert(R, false);
        const R_addr = ethers.hexlify(ethers.getBytes(ethers.keccak256(R_uncomp.slice(1, 65))).slice(12, 32));

        // e = keccak256(address(R) || compressed publicKey || m)
        const e = ethers.getBytes(ethers.solidityPackedKeccak256(
            ["address", "uint8", "bytes32", "bytes32"],
            [R_addr, publicKey[0] + 27 - 2, publicKey.slice(1, 33), m]));

        return e;
    }
}

