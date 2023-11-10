import {loadFixture,} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {randomBytes} from "crypto";
import {TransactionRequest} from "ethers";
import Schnorr from "../adapter/schnorr";

const secp256k1 = require('secp256k1')

describe("Adapter", function () {
    async function deploySchnorr() {
        // Contracts are deployed using the first signer/account by default
        const [owner, alice, bob] = await ethers.getSigners();

        const Schnorr = await ethers.getContractFactory("Schnorr");
        const schnorrContract = await Schnorr.deploy();
        return {schnorrContract};
    }

    describe("Deployment", function () {
        it("Should  deploy", async function () {
            const {schnorrContract} = await loadFixture(deploySchnorr);
            // generate privKey
            let privKey
            do {
                privKey = randomBytes(32)
            } while (!secp256k1.privateKeyVerify(privKey))

            const publicKey = secp256k1.publicKeyCreate(privKey);

            // message
            const m = randomBytes(32);

            const sig = Schnorr.sign(m, privKey);
            // @ts-ignore
            const tx: TransactionRequest = schnorrContract.verify(publicKey[0] - 2 + 27, publicKey.slice(1, 33), ethers.getBytes(m), sig.e, sig.s)
            let gas = await ethers.provider.estimateGas(tx)
            console.log("verify gas cost:", gas);
            expect(await tx).to.equal(true);
        });

    });

});
