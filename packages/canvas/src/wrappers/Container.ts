import React, {
  createElement,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  addComponent,
  ChildNodesType,
  DropTargetType,
  getComponentConfig,
  getDropTarget,
  getSelector,
  PageConfigType,
  setDragSortCache, setDropTarget,
  STATE_PROPS,
} from '@brickd/core';
import { useCommon } from '@brickd/hooks';
import { getChildrenFields } from '@brickd/utils';
import { isEqual, get, each, keys, isEmpty, some } from 'lodash';
import { defaultPropName } from 'common/constants';
import {
  generateRequiredProps,
  getComponent,
  getSelectedNode,
  cloneChildNodes,
  dragSort,
  getPropParentNodes,
  getDragKey,
  getIsModalChild,
  PropParentNodes,
  getDragSourceFromKey,
  isAllowAdd,
  isNeedJudgeFather,
  isAllowDrop,
  PropNodesPosition, getVNode,
} from '../utils';

import {
  CommonPropsType,
  handleModalTypeContainer,
  propAreEqual,
  handleChildNodes,
  handlePropsClassName,
} from '../common/handleFuns';
import { useSelect } from '../hooks/useSelect';
import { useChildNodes } from '../hooks/useChildNodes';
import { useSelector } from '../hooks/useSelector';
import { useOperate } from '../hooks/useOperate';
import { useEvents } from '../hooks/useEvents';
import { useNewAddComponent } from '../hooks/useNewAddComponent';
import { useStyleProps } from '../hooks/useStyleProps';
/**
 * 所有的容器组件名称
 */

export type ContainerState = {
  pageConfig: PageConfigType;
  dropTarget: DropTargetType;
};
function Container(allProps: CommonPropsType) {
  const {
    specialProps,
    specialProps: { key, domTreeKeys },
    ...rest
  } = allProps;

  const controlUpdate = useCallback(
    (prevState: ContainerState, nextState: ContainerState) => {
      const { pageConfig: prevPageConfig } = prevState;
      const { pageConfig } = nextState;
      if(!isEqual(get(prevPageConfig,key+'.childNodes'),get(pageConfig,key+'.childNodes'))){
        if(pageConfig[key]){
          const {childNodes}=pageConfig[key];
          setChildren(childNodes);
        }
      }
      return prevPageConfig[key] !== pageConfig[key];
    },
    [],
  );

  const { pageConfig } = useSelector<ContainerState, STATE_PROPS>(
    ['pageConfig'],
    controlUpdate,
  );

  const vNode = getVNode(key);
  const { childNodes, componentName } = vNode;
  const dragKey = getDragKey();
  const [isNewComponent,setIsNewComponent] = useState(
    !getDragSourceFromKey('parentKey') && dragKey === key,
  );
  const executeSubject=useNewAddComponent(key);

  const pageConfigs:PageConfigType={...pageConfig,...getDragSourceFromKey('template',{})};
  // const dragOverOrigin=useRef()
  const { props, hidden, pageState } = useCommon(
    vNode,
    rest,
    getChildrenFields(pageConfigs, childNodes),
  );
  const { index = 0 } = pageState;
  const uniqueKey = `${key}-${index}`;
  useChildNodes({ childNodes, componentName, specialProps });
  const [children, setChildren] = useState<ChildNodesType | undefined>(
    childNodes,
  );
  const { mirrorModalField, nodePropsConfig, childNodesRule } = useMemo(
    () => getComponentConfig(componentName),
    [],
  );
  const nodePropNames = keys(nodePropsConfig);
  const prevPropName = useRef(
    nodePropNames.includes(defaultPropName)
      ? defaultPropName
      : nodePropNames[0],
  );
  const isVPropNodesPositionRef = useRef<PropNodesPosition>({});

  const propParentNodes = useRef<PropParentNodes>({});
  const isModal = useMemo(() => getIsModalChild(pageConfigs, domTreeKeys), [
    pageConfigs,
    domTreeKeys,
  ]);
  const { setOperateState, getOperateState } = useOperate(isModal);
  const selectedInfo = useSelect(
    specialProps,
    !!mirrorModalField,
  );
  const { selectedDomKeys, isSelected, propName }=selectedInfo;
  let selectedPropName = prevPropName.current;
  if (propName && isSelected) {
    prevPropName.current = propName;
    selectedPropName = propName;
  }
  const { setSelectedNode, ...events } = useEvents(
    specialProps,
    selectedInfo,
    props,
    componentName,
    selectedPropName,
    index,
  );


  const interceptDragOver=useCallback(()=>{
    const dragKey = getDragKey();
    const { isLock, isDropAble, operateSelectedKey } = getOperateState();
    const dropKey= get(getDropTarget(),'dropKey');
    if (
      !isDropAble ||
      key !== dropKey ||
      dragKey === operateSelectedKey ||
      domTreeKeys.includes(dragKey) ||
      !isLock
    ) {

      return true;
    }

  },[]);


  const onParentDragOver = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      if(interceptDragOver()) return;
      const isV = isVPropNodesPositionRef.current[defaultPropName];
      if (isEmpty(children)) {
        if (nodePropsConfig) {
          setChildren({ [selectedPropName]: [dragKey] });
        } else {
          setChildren([dragKey]);
        }
        setDragSortCache([dragKey]);
      } else if (Array.isArray(children)) {

        if (children.length === 1 && children.includes(dragKey)) return;
        const newChildren = dragSort(
          children,
          event.target as HTMLElement,
          event,
          isV,
        );
        if (!isEqual(newChildren, children)) {
          setChildren(newChildren);
          setDragSortCache(newChildren);
        }

      } else {
        const propChildren = get(children, selectedPropName, []);

        if (!propChildren.includes(dragKey)) {
          const newChildren = cloneChildNodes(children);
          const childrenResult = [dragKey, ...propChildren];
          setDragSortCache(childrenResult);
          newChildren[selectedPropName] = childrenResult;
          setChildren(newChildren);
        } else {
          setDragSortCache(propChildren);
        }
      }
    },
    [children, setChildren, selectedPropName],
  );



  const dragOver = useCallback(
    (event: DragEvent, propName: string) => {
      event.preventDefault();
      if(interceptDragOver()) return;
        const childNodeKeys = get(children, propName, []);
        const isV = isVPropNodesPositionRef.current[propName];
        if (!childNodeKeys.length) {
          if (isEmpty(children)) {
            setChildren({ [propName]: [dragKey] });
          } else {
            const newChildren = cloneChildNodes(childNodes);
            newChildren[propName] = [dragKey];
            setChildren(newChildren);
          }
          setDragSortCache([dragKey]);
        } else if (
          childNodeKeys.length === 1 &&
          childNodeKeys.includes(dragKey)
        ) {
          return setDragSortCache(childNodeKeys);
        } else {
          const newChildren = dragSort(
            childNodeKeys,
            propParentNodes.current[propName],
            event,
            isV,
          );
          const renderChildren = cloneChildNodes(childNodes)||{};
          renderChildren[propName] = newChildren;
          if (!isEqual(renderChildren, children)) {
            setChildren(renderChildren);
          }
          setDragSortCache(newChildren);
        }
    },
    [setChildren, children],
  );

  const onDragLeave = (event: React.MouseEvent|MouseEvent) => {
    event.stopPropagation();
    setTimeout(() => {
      setChildren(childNodes);
    }, 50);
  };

  const onDrop = useCallback((event: React.DragEvent|MouseEvent) => {
    event.stopPropagation();
    const { selectedInfo } = getSelector(['selectedInfo']);
    const dragKey = getDragKey();
    if (get(selectedInfo,'selectedKey') === dragKey) return;
    setOperateState({ dropNode: null });
    addComponent();
    executeSubject();
  }, []);


  useEffect(() => {
    if (!nodePropsConfig || isEmpty(propParentNodes.current)) return;
    each(propParentNodes.current, (parentNode, propName) => {
      parentNode.ondragover=(event) => dragOver(event, propName);
      parentNode.ondragenter=(event) => onDragEnter(event, propName);
      parentNode.ondragleave=onDragLeave;
      parentNode.ondrop=onDrop;
    });

  }, [onDragLeave,onDrop]);

  useEffect(() => {
    if (dragKey&&domTreeKeys.includes(dragKey)) return;
    if (isNewComponent) {
      setSelectedNode(getSelectedNode(uniqueKey));
      setIsNewComponent(false);
    }

    if (
      (Array.isArray(childNodes) &&
        isVPropNodesPositionRef.current[defaultPropName] === undefined) ||
      some(
        childNodes,
        (_, propName) =>
          isVPropNodesPositionRef.current[propName] === undefined,
      )
    ) {
      getPropParentNodes(
        childNodes,
        propParentNodes.current,
        isVPropNodesPositionRef.current,
        index,
      );
    }
  }, [childNodes,isNewComponent,dragKey,setIsNewComponent]);

  const interceptDragEnter=useCallback(()=>{
    const dragKey = getDragKey();
    const { operateSelectedKey } = getOperateState();
    if (
      domTreeKeys.includes(dragKey) ||
      dragKey === key ||
      dragKey === operateSelectedKey){
      setDropTarget(null);
      setOperateState({
        dropNode:null,
        isDropAble:false,
        index,
        isLock: true,
      });

      return true;
    }
  },[]);

  const onParentDragEnter = useCallback(
    (event: DragEvent) => {
      event.stopPropagation();
      if(interceptDragEnter()) return;
      let isDropAble;
      if (nodePropsConfig) {
        const { childNodesRule } = nodePropsConfig[selectedPropName];
        isDropAble =
          isAllowDrop(childNodesRule) &&
          isAllowAdd(componentName + selectedPropName);
      } else {
        isDropAble = isAllowDrop(childNodesRule) && isAllowAdd(componentName);
      }
      isDropAble = Number.parseInt(index) === 0 && isDropAble;
      const dropNode=event.target as HTMLElement;
      setOperateState({
        dropNode,
        isDropAble,
        index,
        isLock: true,
      });

      if (!isDropAble) return;
      setDropTarget({
        propName: selectedPropName,
        dropKey: key,
        domTreeKeys,
        childNodeKeys: Array.isArray(childNodes)
          ? childNodes
          : get(childNodes, selectedPropName, []),
      });
    },
    [childNodes, selectedPropName],
  );

  const onDragEnter = useCallback(
    (event: DragEvent, propName?: string) => {
      event.stopPropagation();
      if(interceptDragEnter()) return;

      const { childNodesRule } = nodePropsConfig[propName];
      const isDropAble =
        isAllowDrop(childNodesRule) &&
        (!isNeedJudgeFather() || isAllowAdd(componentName)) &&
        Number.parseInt(index) === 0;
      const dropNode=propParentNodes.current[propName];

      setOperateState({
        dropNode,
        isDropAble,
        index,
        isLock: true,
      });
      if (!isDropAble) return;
      setDropTarget({
        propName,
        dropKey: key,
        domTreeKeys,
        childNodeKeys: get(childNodes, propName, []),
      });
    },
    [childNodes],
  );

  let modalProps: any = {};
  if (mirrorModalField) {
    const { displayPropName, mountedProps } = handleModalTypeContainer(
      mirrorModalField,
    );
    if (displayPropName) {
      const isVisible =
        isSelected || (selectedDomKeys && selectedDomKeys.includes(key));
      modalProps = isVisible
        ? { [displayPropName]: isVisible, ...mountedProps }
        : mountedProps;
    } else {
      modalProps = mountedProps;
    }
  }
  const { className, animateClass, ...restProps } = props || {};
  const childNodesProps = useMemo(
    () =>
      handleChildNodes(
        specialProps,
        { ...pageState, ...pageState.getPageState() },
        componentName,
        children,
      ),
    [children, pageState, pageState.getPageState(), specialProps],
  );

  const styleProps=useStyleProps(componentName,specialProps,handlePropsClassName(
    uniqueKey,
    domTreeKeys.includes(dragKey),
    className,
    animateClass
  ),selectedInfo);
  if (!isSelected && (!componentName || hidden)) return null;
  return createElement(getComponent(componentName), {
    ...styleProps,
    ...restProps,
    onDragEnter: onParentDragEnter,
    onDragOver: onParentDragOver,
    onDragLeave,
    onDrop,
    ...events,
    ...generateRequiredProps(componentName),
    ...childNodesProps,
    draggable: true,
    /**
     * 设置组件id方便抓取图片
     */
    ...modalProps,
  });
}

export default memo<CommonPropsType>(Container, propAreEqual);
