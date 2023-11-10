import {randomBytes} from "crypto";
import {privateKeyVerify} from "secp256k1";

export const randomBytesVerified = (numberBytes: number) => {
    let bytes;
    do {
        bytes = randomBytes(numberBytes)
    } while (!privateKeyVerify(bytes))
    return bytes;
}
