import {SfuExtended} from "../../../../src";
import {ATTACHMENT_ID_LENGTH} from "../../../../src/sdk/constants";

// Only for local or manual tests
describe.skip("converting-attachment-id", () => {
    it("should convert generated id to byte array and back to string",() => {
        for (let i = 0; i < 100000; i++) {
            const generatedId = SfuExtended.generateAttachmentId();
            expect(generatedId.length).toBe(ATTACHMENT_ID_LENGTH);
            const bytes = SfuExtended.strToUTF8Array(generatedId);
            expect(bytes.length).toBe(ATTACHMENT_ID_LENGTH);
            const decodedFromBytes = SfuExtended.fromUTF8ArrayToStr(new Uint8Array(bytes));
            expect(decodedFromBytes).toEqual(generatedId);
        }
    })
})