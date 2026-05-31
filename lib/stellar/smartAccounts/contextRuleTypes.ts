import { Address, xdr } from "@stellar/stellar-sdk"

export type ContextRuleType =
  | { tag: "Default"; values: undefined }
  | { tag: "CallContract"; values: [string] }
  | { tag: "CreateContract"; values: [Buffer] }

/** Mirror smart-account-kit buildContextRuleTypes for signer keyData lookup. */
export function buildContextRuleTypesFromAuthEntry(
  entry: xdr.SorobanAuthorizationEntry,
): ContextRuleType[] {
  const types: ContextRuleType[] = []
  const seen = new Set<string>()

  const add = (type: ContextRuleType) => {
    let key: string
    if (type.tag === "Default") {
      key = "Default"
    } else if (type.tag === "CallContract") {
      key = `CallContract:${type.values[0]}`
    } else {
      key = `CreateContract:${type.values[0].toString("hex")}`
    }
    if (!seen.has(key)) {
      seen.add(key)
      types.push(type)
    }
  }

  const walk = (invocation: xdr.SorobanAuthorizedInvocation) => {
    const fn = invocation.function()
    const switchName = fn.switch().name
    if (switchName === "sorobanAuthorizedFunctionTypeContractFn") {
      const args = fn.contractFn()
      const contractAddress = Address.fromScAddress(args.contractAddress()).toString()
      add({ tag: "CallContract", values: [contractAddress] })
    } else if (switchName.startsWith("sorobanAuthorizedFunctionTypeCreateContract")) {
      const wasmHash = extractCreateContractWasmHash(fn)
      if (wasmHash) {
        add({ tag: "CreateContract", values: [wasmHash] })
      }
    }
    for (const sub of invocation.subInvocations()) {
      walk(sub)
    }
  }

  walk(entry.rootInvocation())
  add({ tag: "Default", values: undefined })
  return types
}

function extractCreateContractWasmHash(fn: xdr.SorobanAuthorizedFunction): Buffer | null {
  const fnAny = fn as xdr.SorobanAuthorizedFunction & {
    createContractHostFn?: () => { executable?: () => { switch?: () => { name: string }; wasm?: () => Buffer } }
    createContractWithCtorHostFn?: () => { executable?: () => { switch?: () => { name: string }; wasm?: () => Buffer } }
    createContractWithConstructorHostFn?: () => {
      executable?: () => { switch?: () => { name: string }; wasm?: () => Buffer }
    }
  }
  const candidates = [
    fnAny.createContractHostFn?.(),
    fnAny.createContractWithCtorHostFn?.(),
    fnAny.createContractWithConstructorHostFn?.(),
  ]
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue
    const ctx = candidate as {
      executable?: (() => { switch?: () => { name: string }; wasm?: () => Buffer }) | {
        switch?: () => { name: string }
        wasm?: () => Buffer
      }
    }
    const executable =
      typeof ctx.executable === "function" ? ctx.executable() : ctx.executable
    if (!executable || typeof executable !== "object") continue
    const execAny = executable as { switch?: () => { name: string }; wasm?: () => Buffer }
    const execSwitch = execAny.switch?.()
    if (execSwitch?.name === "contractExecutableWasm") {
      const wasm = typeof execAny.wasm === "function" ? execAny.wasm() : execAny.wasm
      if (wasm) return Buffer.from(wasm)
    }
  }
  return null
}
