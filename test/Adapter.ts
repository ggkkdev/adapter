import {loadFixture,} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {ethers} from "hardhat";
import {HDNodeWallet, Signer, Transaction, TransactionLike} from "ethers";
import {expect} from "chai";
import SchnorrAdapter, {IPresignOutput} from "../adapter/adapter";
import {publicKeyCreate} from "secp256k1";
// @ts-ignore
import {MyToken, Schnorr} from "../typechain-types";
import * as net from "net";
import {zeroOutSlices} from "hardhat/internal/hardhat-network/stack-traces/library-utils";


describe("Adapter", function () {

    let alice: HDNodeWallet;
    let bob: HDNodeWallet;
    let owner: Signer;
    let schnorrContract: Schnorr;
    let token1: MyToken;
    let token2: MyToken;
    let preSignAlice: IPresignOutput;
    let preSignBob: IPresignOutput;
    let sBob: Uint8Array;
    let tRecovered: Uint8Array;
    let chainId: bigint;
    let m1: Uint8Array;
    let m2: Uint8Array;
    //let tx1: TransactionLike;
    //let tx2: TransactionLike;
    let amount1 = 10n ** 5n
    let amount2 = 10n ** 6n


    async function deploy() {
        // Contracts are deployed using the first signer/account by default
        const [owner] = await ethers.getSigners();
        const alice = ethers.Wallet.createRandom().connect(ethers.provider);
        const bob = ethers.Wallet.createRandom().connect(ethers.provider);
        const Schnorr = await ethers.getContractFactory("Schnorr");
        const schnorrContract = await Schnorr.deploy();
        const schnorrAddress = await schnorrContract.getAddress();
        const MyToken = await ethers.getContractFactory("MyToken");
        const token1 = await MyToken.deploy("USD token", "USD");
        const token2 = await MyToken.deploy("EUR token", "EUR");
        return {schnorrContract, owner, alice, bob, token1, token2};
    }

    describe("Deployment", function () {

        it("Should  deploy and setup", async function () {
            const setup = await loadFixture(deploy);
            [alice, bob, owner, schnorrContract, token1, token2] = [setup.alice, setup.bob, setup.owner, setup.schnorrContract, setup.token1, setup.token2];
        })
        it("Should  give alice and bob some eth to perform txs and send tokens", async function () {
            const txEth = await owner.sendTransaction({to: alice.address, value: 10n ** 18n});
            //await txEth.wait();
            const tx2Eth = await owner.sendTransaction({to: bob.address, value: 10n ** 18n});
            //await tx2Eth.wait();
            await token1.mint(alice.address, 10n ** 18n);
            await token2.mint(bob.address, 10n ** 18n);
        })
        it("Should  prepare messages as tx hashes", async function () {
            //tx1 = await token1.connect(alice).transfer.populateTransaction(bob.address, 10n ** 5n)
            //tx2 = await token2.connect(bob).transfer.populateTransaction(alice.address, 10n ** 5n)
            //const l = await ethers.provider.estimateGas(tx);
            //const res = await alice.sendTransaction(tx);
            chainId = (await ethers.provider.getNetwork()).chainId
            const token1Address = await token1.getAddress();
            const token2Address = await token2.getAddress();
            const pA = ethers.getBytes(alice.publicKey)
            const pB = ethers.getBytes(bob.publicKey)
            m1 = ethers.getBytes(ethers.solidityPackedKeccak256(
                ["uint", "address", "address", "address","uint"],
                [chainId, token1Address, alice.address, bob.address, amount1]));
            m2 = ethers.getBytes(ethers.solidityPackedKeccak256(
                ["uint", "address", "address", "address","uint"],
                [chainId, token2Address, bob.address, alice.address, amount2]));
            //m1 = ethers.getBytes(Transaction.from(tx1).unsignedHash);
            //m2 = ethers.getBytes(Transaction.from(tx2).unsignedHash);
        })
        it("Should  presign with Alice", async function () {
            preSignAlice = SchnorrAdapter.presign(m1, ethers.getBytes(alice.privateKey))
        });

        it("Should  verify with Bob", async function () {
            const result = SchnorrAdapter.verify(preSignAlice.sAdapt, preSignAlice.R, preSignAlice.T, ethers.getBytes(alice.publicKey), m1)
            expect(result).to.equal(true);
        });

        it("Should  presign with Bob given T", async function () {
            preSignBob = SchnorrAdapter.presign(m2, ethers.getBytes(bob.privateKey), preSignAlice.T);

        });
        it("Should  verify with Alice", async function () {
            const result = SchnorrAdapter.verify(preSignBob.sAdapt, preSignBob.R, preSignBob.T, ethers.getBytes(bob.publicKey), m2)
            expect(result).to.equal(true);
        });
        it("Should adapt with Alice the adapter signature from Bob", async function () {
            sBob = SchnorrAdapter.adapt(preSignBob.sAdapt, preSignAlice.t)
            const pk = ethers.getBytes(bob.publicKey);
            const result = await schnorrContract.verify(pk[0] - 2 + 27, pk.slice(1, 33), ethers.getBytes(m2), preSignBob.e, sBob)
            expect(result).to.equal(true);
        });
        it("Should send tx with Alice with the adapter signature from Bob", async function () {
            const pk = ethers.getBytes(bob.publicKey);
            const result=await token2.transferOnBehalf(0,bob.address, alice.address, amount2,pk[0] - 2 + 27, pk.slice(1, 33),sBob, preSignBob.e);
            const receipt=await result.wait();
            console.log(receipt)
            console.log(result)
            //const result = await schnorrContract.verify(pk[0] - 2 + 27, pk.slice(1, 33), ethers.getBytes(m2), preSignBob.e, sBob)
            expect(result).to.equal(true);
        });
        it("Should recover t with Bob from sBob signature sent by Alice", async function () {
            tRecovered = SchnorrAdapter.recover(sBob, preSignBob.sAdapt);
            const Trecovered = publicKeyCreate(tRecovered);
            expect(ethers.hexlify(Trecovered)).to.equal(ethers.hexlify(preSignAlice.T));
        });
        it("Should adapt with Bob the adapter signature from Alice", async function () {
            const sAlice = SchnorrAdapter.adapt(preSignAlice.sAdapt, tRecovered);
            const pk = ethers.getBytes(alice.publicKey);
            const result = await schnorrContract.verify(pk[0] - 2 + 27, pk.slice(1, 33), ethers.getBytes(m1), preSignAlice.e, sAlice)
            expect(result).to.equal(true);
        });
    });

});
