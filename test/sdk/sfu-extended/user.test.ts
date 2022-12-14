import { UPDATED_PMI_SETTINGS} from "../../util/constants";
import { waitForUser } from "../../util/utils";
import { SfuExtended } from "../../../src";

describe("user", () => {
    let bob: SfuExtended;
    beforeEach(async () => {
        bob = await waitForUser();
    })
    afterEach(async () => {
        await bob.disconnect();
    })
    it("Should load user PMI settings", async () => {
        const pmiSettings = await bob.getUserPmiSettings();
        expect(pmiSettings).toBeTruthy();
    })
    it("Should update user PMI settings", async () => {
        const pmiSettings = await bob.getUserPmiSettings();
        expect(pmiSettings).toBeTruthy();
        await bob.updateUserPmiSettings(UPDATED_PMI_SETTINGS);
        const updatedSettings = await bob.getUserPmiSettings();
        expect(updatedSettings.pmiSettings.accessCode).toBe(UPDATED_PMI_SETTINGS.accessCode);
    })
});