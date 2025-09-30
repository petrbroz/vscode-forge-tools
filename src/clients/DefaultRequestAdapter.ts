import { FetchRequestAdapter } from "@microsoft/kiota-http-fetchlibrary";
import { AuthenticationProvider, ParseNodeFactoryRegistry, SerializationWriterFactoryRegistry } from "@microsoft/kiota-abstractions";
import { ClientCredentialsAuthenticationProvider } from "./ClientCredentialsAuthenticationProvider.js";
import { JsonParseNodeFactory, JsonSerializationWriterFactory } from "@microsoft/kiota-serialization-json";

const pnfr = new ParseNodeFactoryRegistry();
const json = new JsonParseNodeFactory();
pnfr.contentTypeAssociatedFactories.set(json.getValidContentType(), json);
const swfr = new SerializationWriterFactoryRegistry();
const jsonWriter = new JsonSerializationWriterFactory();
swfr.contentTypeAssociatedFactories.set(jsonWriter.getValidContentType(), jsonWriter);

export class DefaultRequestAdapter extends FetchRequestAdapter {
    constructor(authenticationProvider: AuthenticationProvider = new ClientCredentialsAuthenticationProvider()) {
        super(authenticationProvider, pnfr, swfr);
    }
}
