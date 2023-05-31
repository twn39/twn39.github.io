import { Key, ReactElement, useRef, useState } from "react";
import users from "../../../usersmock.json";
import { UserTableListStyle } from "./styled.ts";
import { Button, Input, InputRef, Space, Table } from "antd";
import { ColumnsType, ColumnType } from "antd/es/table";
import { useSignal } from "@preact/signals-react";
import { FilterConfirmProps } from "antd/es/table/interface";
import { SearchOutlined } from "@ant-design/icons";
import Highlighter from "react-highlight-words";

type UserItem = {
  username: string;
  age: number;
  email: string;
  gender: string;
  phone: string;
  location: string;
  name: string;
  nat: string;
};

export default function UserTableList(): ReactElement {
  const currentPage = useSignal(1);
  const pageSize = useSignal(20);
  const [searchText, setSearchText] = useState("");
  const [searchedColumn, setSearchedColumn] = useState("");
  const searchInput = useRef<InputRef>(null);

  const usersData: UserItem[] = users.results.map((it) => {
    return {
      username: it.login.username,
      email: it.email,
      age: it.dob.age,
      gender: it.gender,
      phone: it.phone,
      location: `${it.location.city} ${it.location.state} ${it.location.country}`,
      name: `${it.name.first} ${it.name.last}`,
      nat: it.nat,
    };
  });

  const handleSearch = (
    selectedKeys: string[],
    confirm: (param?: FilterConfirmProps) => void,
    dataIndex: keyof UserItem
  ) => {
    confirm();
    setSearchText(selectedKeys[0]);
    setSearchedColumn(dataIndex);
  };

  const handleReset = (clearFilters: () => void) => {
    clearFilters();
    setSearchText("");
  };

  const getColumnSearchProps = (
    dataIndex: keyof UserItem
  ): ColumnType<UserItem> => ({
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      clearFilters,
      close,
    }) => (
      <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
        <Input
          ref={searchInput}
          placeholder={`Search ${dataIndex}`}
          value={selectedKeys[0]}
          onChange={(e) =>
            setSelectedKeys(e.target.value ? [e.target.value] : [])
          }
          onPressEnter={() =>
            handleSearch(selectedKeys as string[], confirm, dataIndex)
          }
          style={{ marginBottom: 8, display: "block" }}
        />
        <Space>
          <Button
            type="primary"
            onClick={() =>
              handleSearch(selectedKeys as string[], confirm, dataIndex)
            }
            icon={<SearchOutlined />}
            size="small"
            style={{ width: 90 }}
          >
            Search
          </Button>
          <Button
            onClick={() => clearFilters && handleReset(clearFilters)}
            size="small"
            style={{ width: 90 }}
          >
            Reset
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              confirm({ closeDropdown: false });
              setSearchText((selectedKeys as string[])[0]);
              setSearchedColumn(dataIndex);
            }}
          >
            Filter
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              close();
            }}
          >
            close
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered: boolean) => (
      <SearchOutlined style={{ color: filtered ? "#1677ff" : undefined }} />
    ),
    onFilter: (value, record) =>
      record[dataIndex]
        .toString()
        .toLowerCase()
        .includes((value as string).toLowerCase()),
    onFilterDropdownOpenChange: (visible) => {
      if (visible) {
        setTimeout(() => searchInput.current?.select(), 100);
      }
    },
    render: (text) =>
      searchedColumn === dataIndex ? (
        <Highlighter
          highlightStyle={{ backgroundColor: "#ffc069", padding: 0 }}
          searchWords={[searchText]}
          autoEscape
          textToHighlight={text ? text.toString() : ""}
        />
      ) : (
        text
      ),
  });

  const columns: ColumnsType<UserItem> = [
    {
      title: "Username",
      dataIndex: "username",
      key: "username",
      width: 160,
      fixed: "left",
      ...getColumnSearchProps("username"),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      width: 200,
      fixed: "left",
      ...getColumnSearchProps("email"),
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      ...getColumnSearchProps("name"),
    },
    {
      title: "Age",
      dataIndex: "age",
      key: "age",
      sorter: (a, b) => a.age - b.age,
    },
    {
      title: "Gender",
      dataIndex: "gender",
      key: "gender",
      filters: [
        { text: "Male", value: "male" },
        { text: "Female", value: "female" },
      ],
      onFilter: (value, record) => record.gender === value,
    },
    {
      title: "Phone",
      dataIndex: "phone",
      key: "phone",
      ...getColumnSearchProps("phone"),
    },
    {
      title: "Location",
      dataIndex: "location",
      key: "location",
      ...getColumnSearchProps("location"),
    },
    {
      title: "Nat",
      dataIndex: "nat",
      key: "nat",
      ...getColumnSearchProps("nat"),
    },
  ];

  const rowSelection = {
    onchange: (selectedRowKeys: Key[], selectedRows: UserItem[]) => {
      console.log(selectedRowKeys, selectedRows);
    },
    getCheckboxProps: (record: UserItem) => {
      console.log(record);
      return {
        disabled: false,
        name: record.email,
      };
    },
  };

  const onShowSizeChange = (current: number, size: number) => {
    currentPage.value = current;
    pageSize.value = size;
  };

  const onPageChange = (page: number) => {
    currentPage.value = page;
  };

  return (
    <UserTableListStyle>
      <Table
        rowKey={(record) => record.email}
        rowSelection={{
          type: "checkbox",
          ...rowSelection,
        }}
        dataSource={usersData}
        columns={columns}
        pagination={{
          onChange: onPageChange,
          onShowSizeChange: onShowSizeChange,
          pageSize: pageSize.value,
          current: currentPage.value,
          defaultCurrent: currentPage.value,
        }}
        scroll={{ x: 1500, y: 700 }}
      />
    </UserTableListStyle>
  );
}
