# Adapter schnorr signatures 
Cheap verifier from https://hackmd.io/@nZ-twauPRISEa6G9zg3XRw/SyjJzSLt9

```shell
npm i 
npx hardhat compile
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.ts
```

```shell
Alice presigns sA_adapt: sA_adapt=r1+H(R1+T||A||m1)*a
She sends (sA_adapt, R1,T) to Bob
Bob presigns sB_adapt=r2+H(R2+T||B||m2)*b
He sends (sB_adapt, R2)
Alice adapts it : sB=sB_adapt+t
She sends it to the blockchain revealing t to Bob
Bob first compute t : t=sB-sB_adapt
and adapt Alice signature: sA=sA_adapt+t
He sends it to the blockchain



```
