import { useState, useEffect, useRef, useMemo } from "react";
import { Form, Button, Toast, Banner, Spin, Tooltip } from "@douyinfe/semi-ui";
import {
  IFieldMeta as FieldMeta,
  IWidgetTable,
  FieldType,
  IOpenSegmentType,
  TableMeta,
  bitable,
  IOpenSegment,
} from "@base-open/web-api";
import "./App.css";
import { icons } from "./icons";
import { useTranslation } from "react-i18next";
import { geo, regeo, checkEmpty } from "./api";

//@ts-ignore
window.bitable = bitable;

let moreConfig = {
  /** 为true的时候表示，单元格如果有值，则不设置这个单元格,key为checkbox的value属性 */
  cover: true,
};

export function getMoreConfig() {
  return moreConfig;
}

export function setLoading(l: boolean) {
  loading = l;
  forceUpdateCom();
}

let loading = false;

let _forceUpdate: any;

export function forceUpdateCom() {
  return _forceUpdate({});
}

/** 表格，字段变化的时候刷新插件 */
export default function Ap() {
  const [key, setKey] = useState<string | number>(0);
  const [tableList, setTableList] = useState<IWidgetTable[]>([]);
  // 绑定过的tableId
  const bindList = useRef<Set<string>>(new Set());

  const refresh = useMemo(
    () => () => {
      const t = new Date().getTime();
      setKey(t);
    },
    []
  );

  useEffect(() => {
    bitable.base.getTableList().then((list) => {
      setTableList(list);
    });
    const deleteOff = bitable.base.onTableDelete(() => {
      setKey(new Date().getTime());
    });
    const addOff = bitable.base.onTableAdd(() => {
      setKey(new Date().getTime());
      bitable.base.getTableList().then((list) => {
        setTableList(list);
      });
    });
    return () => {
      deleteOff();
      addOff();
    };
  }, []);

  useEffect(() => {
    if (tableList.length) {
      tableList.forEach((table) => {
        if (bindList.current.has(table.id)) {
          return;
        }
        table.onFieldAdd(refresh);
        table.onFieldDelete(refresh);
        table.onFieldModify(refresh);
        bindList.current.add(table.id);
      });
    }
  }, [tableList]);

  return <Translate key={key}></Translate>;
}

function Translate() {
  const { t } = useTranslation();
  const [btnDisabled, setBtnDisabled] = useState(true);
  const [tableMetaList, setTableMetaList] = useState<TableMeta[]>();
  const [tableLoading, setTableLoading] = useState(false);
  const [tableId, setTableId] = useState<string>();
  const [opType, setOpType] = useState<string>("geo");
  const formApi = useRef<any>();
  const [, f] = useState();
  _forceUpdate = f;
  const [table, setTable] = useState<IWidgetTable>();
  const filedInfo = useRef<{
    text: FieldMeta[];
    location: FieldMeta[];
    number: FieldMeta[];
  }>({ text: [], number: [], location: [] });

  useEffect(() => {
    setTableLoading(true);
    bitable.base.getTableMetaList().then(async (r) => {
      setTableMetaList(r.filter(({ name }) => name));
      const choosedTableId = (await bitable.base.getSelection()).tableId;
      formApi.current.setValues({
        table: choosedTableId,
        others: Object.entries(moreConfig)
          .filter(([k, v]) => v)
          .map(([k, v]) => k),
      });
      setTableId(choosedTableId!);
      setTableLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!tableId) {
      return;
    }
    setLoading(true);
    formApi.current.setValue("targetField", "");
    formApi.current.setValue("sourceField", "");
    formApi.current.setValue("targetLang", "");
    bitable.base.getTableById(tableId).then((table) => {
      setTable(table);
      const textArr: FieldMeta[] = [];
      const numberArr: FieldMeta[] = [];
      const locationArr: FieldMeta[] = [];
      table.getFieldMetaList().then((m) => {
        Promise.allSettled(
          m.map(async (meta) => {
            switch (meta.type) {
              case FieldType.Text:
                textArr.push(meta);
                break;
              case FieldType.Number:
                numberArr.push(meta);
                break;
              case FieldType.Location:
                locationArr.push(meta);
                break;
              case FieldType.Lookup:
              case FieldType.Formula:
                const field = await table.getFieldById(meta.id);
                const proxyType = await field.getProxyType();
                if (proxyType === FieldType.Text) {
                  textArr.push(meta);
                } else if (proxyType === FieldType.Location) {
                  locationArr.push(meta);
                }
                break;
              default:
                break;
            }
            return true;
          })
        ).finally(() => {
          filedInfo.current.text = textArr;
          filedInfo.current.location = locationArr;
          filedInfo.current.number = numberArr;
          setLoading(false);
          forceUpdateCom();
        });
      });
    });
  }, [tableId]);

  const onClickStart = async () => {
    const { sourceField: sourceFieldId, targetField: targetFieldId } =
      formApi.current.getValues();
    if (!sourceFieldId) {
      Toast.error(t("choose.sourceField"));
      return;
    }
    if (!tableId) {
      Toast.error(t("err.table"));
      return;
    }
    setLoading(true);
    const table = await bitable.base.getTableById(tableId);
    const sourceField = await table.getFieldById(sourceFieldId);
    const sourceValueList = await sourceField.getFieldValueList();
    const inputList: any = [];
    sourceValueList.forEach(({ record_id, value }, index) => {
      if (Array.isArray(value)) {
        inputList.push({
          record_id: record_id,
          input: value.map(({ type, text }: any) => text).join(""),
        });
      }
    });
    const geoResult =
      opType === "geo" ? await geo(inputList) : await regeo(inputList);
    if (Array.isArray(geoResult)) {
      await geoResult.forEach(({ record_id, location }: any) => {
        if (opType === "geo") {
          table.setCellValue(targetFieldId, record_id, {
            address: checkEmpty(location.original_address),
            adname: checkEmpty(location.district),
            cityname: checkEmpty(location.city),
            full_address: checkEmpty(location.formatted_address),
            location: checkEmpty(location.location),
            name: checkEmpty(location.formatted_address),
            pname: checkEmpty(location.province),
          });
        } else {
          if (location.formatted_address.length > 0) {
            table.setCellValue(targetFieldId, record_id, {
              address: checkEmpty(location.formatted_address),
              adname: checkEmpty(location.addressComponent.district),
              cityname: checkEmpty(location.addressComponent.city),
              full_address: checkEmpty(location.formatted_address),
              location: checkEmpty(location.location),
              name: checkEmpty(location.formatted_address),
              pname: checkEmpty(location.addressComponent.province),
            });
          }
        }
      });
    }
    setLoading(false);
    Toast.success(t("success"));
  };

  const onFormChange = (e: any) => {
    const { sourceField } = e.values;
    if (!sourceField) {
      setBtnDisabled(true);
    } else {
      setBtnDisabled(false);
    }
  };

  return (
    <div>
      <Spin spinning={loading || tableLoading}>
        <Form
          onChange={onFormChange}
          disabled={loading}
          getFormApi={(e: any) => {
            formApi.current = e;
          }}
        >
          <Form.Select
            onChange={(tableId) => setTableId(tableId as string)}
            field="table"
            label={t("choose.table")}
          >
            {Array.isArray(tableMetaList) &&
              tableMetaList.map(({ id, name }) => (
                <Form.Select.Option key={id} value={id}>
                  <div className="semi-select-option-text">{name}</div>
                </Form.Select.Option>
              ))}
          </Form.Select>
          <Form.Select
            field="opType"
            label={t("choose.opType")}
            placeholder={t("choose")}
            onChange={(e) => setOpType(e as string)}
          >
            <Form.Select.Option value="geo" key="geo">
              {t("opType.addressToLocation")}
            </Form.Select.Option>
            <Form.Select.Option value="regeo" key="regeo">
              {t("opType.xyToLocation")}
            </Form.Select.Option>
          </Form.Select>

          <Form.Select
            field="sourceField"
            label={
              opType === "geo"
                ? t("choose.sourceField.address")
                : t("choose.sourceField.xy")
            }
            placeholder={t("choose")}
          >
            {filedInfo.current.text.map((m) => {
              return (
                <Form.Select.Option value={m.id} key={m.id}>
                  <div className="semi-select-option-text">
                    {/* @ts-ignore */}
                    {icons[m.type]}
                    {m.name}
                  </div>
                </Form.Select.Option>
              );
            })}
          </Form.Select>
          <Form.Select
            field="targetField"
            label={t("choose.targetField")}
            placeholder={t("choose")}
          >
            {filedInfo.current.location.map((m) => {
              return (
                <Form.Select.Option value={m.id} key={m.id}>
                  <div className="semi-select-option-text">
                    {/* @ts-ignore */}
                    {icons[m.type]}
                    {m.name}
                  </div>
                </Form.Select.Option>
              );
            })}
          </Form.Select>
        </Form>
      </Spin>{" "}
      <br></br>
      <Button
        disabled={btnDisabled}
        type="primary"
        className="bt1"
        loading={loading}
        onClick={onClickStart}
      >
        {t("start.btn")}
      </Button>
    </div>
  );
}
