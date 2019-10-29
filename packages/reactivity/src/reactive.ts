/*
 * @Author: jinhaidi
 * @Date: 2019-10-15 12:42:16
 * @Description: reactive 函数
 * @Description： vue3.0实现响应式的核心函数
 * @LastEditTime: 2019-10-29 19:04:51
 */
import { isObject, toRawType } from '@vue/shared'
import { mutableHandlers, readonlyHandlers } from './baseHandlers'
import {
  mutableCollectionHandlers,
  readonlyCollectionHandlers
} from './collectionHandlers'
import { ReactiveEffect } from './effect'
import { UnwrapRef, Ref } from './ref'
import { makeMap } from '@vue/shared'

// The main WeakMap that stores {target -> key -> dep} connections.
// Conceptually, it's easier to think of a dependency as a Dep class
// which maintains a Set of subscribers, but we simply store them as
// raw Sets to reduce memory overhead.
export type Dep = Set<ReactiveEffect>
export type KeyToDepMap = Map<any, Dep>
export const targetMap = new WeakMap<any, KeyToDepMap>()

// WeakMaps that store {raw <-> observed} pairs.
// https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/WeakMap
const rawToReactive = new WeakMap<any, any>()
const reactiveToRaw = new WeakMap<any, any>()
const rawToReadonly = new WeakMap<any, any>()
const readonlyToRaw = new WeakMap<any, any>()

// WeakSets for values that are marked readonly or non-reactive during
// observable creation.
const readonlyValues = new WeakSet<any>()
const nonReactiveValues = new WeakSet<any>()

// https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Set
const collectionTypes = new Set<Function>([Set, Map, WeakMap, WeakSet])
const isObservableType = /*#__PURE__*/ makeMap(
  'Object,Array,Map,Set,WeakMap,WeakSet'
)

/**
 * @description: 是否能被Observe
 * @param {value} 任意值
 * @return: boolean
 */
const canObserve = (value: any): boolean => {
  return (
    !value._isVue &&
    !value._isVNode &&
    isObservableType(toRawType(value)) &&
    !nonReactiveValues.has(value)
  )
}

// only unwrap nested ref
// 仅展开嵌套引用
type UnwrapNestedRefs<T> = T extends Ref ? T : UnwrapRef<T>

/**
 * @description: reactive
 * @param {target} T extends object
 * @return: UnwrapNestedRefs
 */
export function reactive<T extends object>(target: T): UnwrapNestedRefs<T>
export function reactive(target: object) {
  // if trying to observe a readonly proxy, return the readonly version.
  if (readonlyToRaw.has(target)) {
    return target
  }
  // target is explicitly marked as readonly by user
  if (readonlyValues.has(target)) {
    return readonly(target)
  }
  return createReactiveObject(
    target,
    rawToReactive,
    reactiveToRaw,
    mutableHandlers,
    mutableCollectionHandlers
  )
}

/**
 * @description: 只读
 * @param {type} T extends object
 * @return: 只读类型
 */
export function readonly<T extends object>(
  target: T
): Readonly<UnwrapNestedRefs<T>> {
  // value is a mutable observable, retrieve its original and return
  // a readonly version.
  if (reactiveToRaw.has(target)) {
    target = reactiveToRaw.get(target)
  }
  return createReactiveObject(
    target,
    rawToReadonly,
    readonlyToRaw,
    readonlyHandlers,
    readonlyCollectionHandlers
  )
}

// ProxyHandler
// https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler

/**
 * @description: 创建Reactive对象
 * @param {target} any
 * @param {toProxy} WeakMap<any, any> 用于保存原始数据
 * @param {toRaw} WeakMap<any, any> 用于保存可响应数据
 * @param {baseHandlers} ProxyHandler<any>
 * @param {collectionHandlers} ProxyHandler<any>
 * @return:
 */
function createReactiveObject(
  target: unknown,
  toProxy: WeakMap<any, any>,
  toRaw: WeakMap<any, any>,
  baseHandlers: ProxyHandler<any>,
  collectionHandlers: ProxyHandler<any>
) {
  // 如果target 不是对象
  if (!isObject(target)) {
    if (__DEV__) {
      console.warn(`value cannot be made reactive: ${String(target)}`)
    }
    return target
  }
  // target already has corresponding Proxy
  // 如果target 已经存在在相应的代理中则返回
  let observed = toProxy.get(target)
  // 不为undefined 时返回observed
  if (observed !== void 0) {
    return observed
  }
  // target is already a Proxy
  // 如果target已经在代理中同样返回
  if (toRaw.has(target)) {
    return target
  }
  // only a whitelist of value types can be observed.
  // 如果target并不能被observe 则返回
  if (!canObserve(target)) {
    return target
  }

  // 如果collectionTypes继承于target，handlers为collectionHandlers
  // 不存在的话handlers为baseHandlers
  const handlers = collectionTypes.has(target.constructor)
    ? collectionHandlers
    : baseHandlers

  // 创建一个Proxy对象
  observed = new Proxy(target, handlers)
  toProxy.set(target, observed)
  toRaw.set(observed, target)
  if (!targetMap.has(target)) {
    targetMap.set(target, new Map())
  }
  return observed
}

/**
 * @description: 判断是不是Reactive
 * @param {value} any
 * @return: boolean
 */
export function isReactive(value: unknown): boolean {
  return reactiveToRaw.has(value) || readonlyToRaw.has(value)
}

/**
 * @description: 是不是只读
 * @param {value} any
 * @return: boolean
 */
export function isReadonly(value: unknown): boolean {
  return readonlyToRaw.has(value)
}

/**
 * @description: 获取 === get
 * @param {observed} T
 * @return: T
 */
export function toRaw<T>(observed: T): T {
  return reactiveToRaw.get(observed) || readonlyToRaw.get(observed) || observed
}

/**
 * @description: 添加只读属性
 * @param {value}  T
 * @return: T
 */
export function markReadonly<T>(value: T): T {
  readonlyValues.add(value)
  return value
}

/**
 * @description: 为nonReactiveValues 添加值
 * @param {value} T
 * @return: T
 */
export function markNonReactive<T>(value: T): T {
  nonReactiveValues.add(value)
  return value
}
