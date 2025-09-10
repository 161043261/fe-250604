import { Plus, Search } from '@icon-park/react';
import { Input, Tooltip } from 'antd';
import { useState } from 'react';
import AddModal from './add-modal';
import CreateGroupModal from './create-group-modal';

const SearchBar: React.FC = () => {
  const [mountAddModal, setMountAddModal] = useState(false);
  const [mountCreateGroupModal, setMountCreateGroupModal] = useState(false);

  const AddOrCreateGroup = (
    <ul className="cursor-pointer">
      <li onClick={() => setMountAddModal(true)}>加好友/群聊</li>
      <li onClick={() => setMountCreateGroupModal(true)}>创建群聊</li>
    </ul>
  );

  return (
    <div>
      <div className="flex items-center gap-5">
        <Input
          placeholder="搜索好友/群聊"
          prefix={<Search theme="outline" size="24" fill="#333" />}
        />
        <Tooltip placement="bottomLeft" title={AddOrCreateGroup} arrow={false}>
          <Plus theme="outline" size="24" fill="#333" className="cursor-pointer" />
        </Tooltip>
      </div>
      {mountAddModal && <AddModal mountModal={mountAddModal} setMountModal={setMountAddModal} />}
      {mountCreateGroupModal && (
        <CreateGroupModal
          mountModal={mountCreateGroupModal}
          setMountModal={setMountCreateGroupModal}
          type="createGroup"
        />
      )}
    </div>
  );
};

export default SearchBar;
